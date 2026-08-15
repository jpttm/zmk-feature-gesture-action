/*
 * Copyright (c) 2026 jpttm
 *
 * SPDX-License-Identifier: MIT
 */

#define DT_DRV_COMPAT jpttm_zmk_behavior_gesture_action

#include <zephyr/device.h>
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/settings/settings.h>

#include <drivers/behavior.h>
#include <zmk/behavior.h>
#include <zmk/behaviors/gesture_action.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

#if DT_HAS_COMPAT_STATUS_OKAY(DT_DRV_COMPAT)

#define SLOT_COUNT CONFIG_ZMK_GESTURE_ACTION_COUNT
#define SETTINGS_PREFIX "ga"
/* Slot names come from the (single) devicetree node; look it up by name rather
 * than threading a device pointer through the public API. */
#define GESTURE_ACTION_DEV_NAME DEVICE_DT_NAME(DT_DRV_INST(0))

/* A slot's compile-time fallback, straight out of default-bindings. Kept as a
 * device name rather than a local ID so it needs no resolution at init time. */
struct default_binding {
    const char *behavior_dev;
    uint32_t param1;
    uint32_t param2;
};

struct behavior_gesture_action_config {
    const struct default_binding *defaults;
    size_t defaults_len;
    const char *const *slot_names;
    size_t slot_names_len;
};

/* Slots live here rather than in per-instance data: the settings keys are
 * global, and more than one instance of this behaviour would be meaningless. */
static struct zmk_gesture_action_entry slots[SLOT_COUNT];

/* What was actually invoked on press, so release matches even if the slot is
 * reassigned while the key is held. */
static struct zmk_behavior_binding held[SLOT_COUNT];
static bool is_held[SLOT_COUNT];

static int settings_set_cb(const char *name, size_t len, settings_read_cb read_cb, void *cb_arg) {
    const char *next;
    if (!settings_name_steq(name, "", &next) || !next) {
        return 0;
    }

    unsigned long slot = strtoul(next, NULL, 10);
    if (slot >= SLOT_COUNT) {
        LOG_WRN("Ignoring stored gesture action for out-of-range slot %lu", slot);
        return 0;
    }

    if (len != sizeof(struct zmk_gesture_action_entry)) {
        LOG_ERR("Stored gesture action %lu is %d bytes, expected %d", slot, (int)len,
                (int)sizeof(struct zmk_gesture_action_entry));
        return -EINVAL;
    }

    int rc = read_cb(cb_arg, &slots[slot], len);
    if (rc < 0) {
        LOG_ERR("Failed to read gesture action %lu: %d", slot, rc);
        return rc;
    }

    return 0;
}

SETTINGS_STATIC_HANDLER_DEFINE(zmk_gesture_action, SETTINGS_PREFIX, NULL, settings_set_cb, NULL,
                               NULL);

static int save_slot(uint8_t slot) {
    char key[32];
    snprintf(key, sizeof(key), SETTINGS_PREFIX "/%u", slot);

    if (slots[slot].behavior_local_id == ZMK_GESTURE_ACTION_UNSET) {
        return settings_delete(key);
    }

    return settings_save_one(key, &slots[slot], sizeof(struct zmk_gesture_action_entry));
}

uint8_t zmk_gesture_action_count(void) { return SLOT_COUNT; }

const char *zmk_gesture_action_name(uint8_t slot) {
    const struct device *dev = zmk_behavior_get_binding(GESTURE_ACTION_DEV_NAME);
    if (!dev) {
        return NULL;
    }

    const struct behavior_gesture_action_config *config = dev->config;
    if (slot >= config->slot_names_len) {
        return NULL;
    }

    return config->slot_names[slot];
}

int zmk_gesture_action_get(uint8_t slot, struct zmk_gesture_action_entry *out) {
    if (slot >= SLOT_COUNT || out == NULL) {
        return -EINVAL;
    }

    *out = slots[slot];
    return 0;
}

int zmk_gesture_action_set(uint8_t slot, const struct zmk_gesture_action_entry *entry,
                           bool persist) {
    if (slot >= SLOT_COUNT || entry == NULL) {
        return -EINVAL;
    }

    slots[slot] = *entry;
    LOG_DBG("Gesture action %u set to local_id %u (%u, %u)", slot, entry->behavior_local_id,
            entry->param1, entry->param2);

    return persist ? save_slot(slot) : 0;
}

int zmk_gesture_action_reset(uint8_t slot, bool persist) {
    if (slot >= SLOT_COUNT) {
        return -EINVAL;
    }

    slots[slot] = (struct zmk_gesture_action_entry){0};

    return persist ? save_slot(slot) : 0;
}

/* Build the binding a slot should invoke: the stored assignment if there is
 * one, otherwise the devicetree default. Returns false when the slot has
 * neither, which is not an error - an unassigned gesture simply does nothing. */
static bool resolve_slot(const struct device *dev, uint8_t slot,
                         struct zmk_behavior_binding *out) {
    const struct behavior_gesture_action_config *config = dev->config;

    if (slots[slot].behavior_local_id != ZMK_GESTURE_ACTION_UNSET) {
        const char *name =
            zmk_behavior_find_behavior_name_from_local_id(slots[slot].behavior_local_id);
        if (name == NULL) {
            /* The stored behaviour is gone - most likely the firmware was
             * rebuilt without it. Fall through to the default rather than
             * leaving the gesture dead. */
            LOG_WRN("Gesture action %u refers to unknown behavior local_id %u", slot,
                    slots[slot].behavior_local_id);
        } else {
            *out = (struct zmk_behavior_binding){
                .behavior_dev = name,
                .param1 = slots[slot].param1,
                .param2 = slots[slot].param2,
            };
            return true;
        }
    }

    if (slot >= config->defaults_len || config->defaults[slot].behavior_dev == NULL) {
        return false;
    }

    *out = (struct zmk_behavior_binding){
        .behavior_dev = config->defaults[slot].behavior_dev,
        .param1 = config->defaults[slot].param1,
        .param2 = config->defaults[slot].param2,
    };
    return true;
}

static int on_gesture_action_pressed(struct zmk_behavior_binding *binding,
                                     struct zmk_behavior_binding_event event) {
    const struct device *dev = zmk_behavior_get_binding(binding->behavior_dev);
    uint32_t slot = binding->param1;

    if (slot >= SLOT_COUNT) {
        LOG_WRN("Gesture action slot %u is out of range (max %d)", slot, SLOT_COUNT - 1);
        return ZMK_BEHAVIOR_OPAQUE;
    }

    struct zmk_behavior_binding target;
    if (!resolve_slot(dev, slot, &target)) {
        LOG_DBG("Gesture action %u is unassigned", slot);
        return ZMK_BEHAVIOR_OPAQUE;
    }

    held[slot] = target;
    is_held[slot] = true;

    zmk_behavior_invoke_binding(&target, event, true);

    return ZMK_BEHAVIOR_OPAQUE;
}

static int on_gesture_action_released(struct zmk_behavior_binding *binding,
                                      struct zmk_behavior_binding_event event) {
    uint32_t slot = binding->param1;

    if (slot >= SLOT_COUNT || !is_held[slot]) {
        return ZMK_BEHAVIOR_OPAQUE;
    }

    is_held[slot] = false;
    zmk_behavior_invoke_binding(&held[slot], event, false);

    return ZMK_BEHAVIOR_OPAQUE;
}

#if IS_ENABLED(CONFIG_ZMK_BEHAVIOR_METADATA)

/* Enumerated rather than a range: a range renders as a slider, which is a poor
 * way to pick one of a few dozen unrelated actions. Listing the values gets a
 * pickable entry per slot instead. */
#define GA_VALUE_ENTRY(i, _)                                                                       \
    {                                                                                              \
        .display_name = STRINGIFY(i),                                                              \
        .value = i,                                                                                \
        .type = BEHAVIOR_PARAMETER_VALUE_TYPE_VALUE,                                               \
    },

static const struct behavior_parameter_value_metadata param_values[] = {
    LISTIFY(SLOT_COUNT, GA_VALUE_ENTRY, ())};

static const struct behavior_parameter_metadata_set param_metadata_set[] = {{
    .param1_values = param_values,
    .param1_values_len = ARRAY_SIZE(param_values),
}};

static const struct behavior_parameter_metadata metadata = {
    .sets_len = ARRAY_SIZE(param_metadata_set),
    .sets = param_metadata_set,
};

#endif // IS_ENABLED(CONFIG_ZMK_BEHAVIOR_METADATA)

static const struct behavior_driver_api behavior_gesture_action_driver_api = {
    .binding_pressed = on_gesture_action_pressed,
    .binding_released = on_gesture_action_released,
#if IS_ENABLED(CONFIG_ZMK_BEHAVIOR_METADATA)
    .parameter_metadata = &metadata,
#endif // IS_ENABLED(CONFIG_ZMK_BEHAVIOR_METADATA)
};

#define GA_DEFAULT_ENTRY(idx, node_id)                                                             \
    {                                                                                              \
        .behavior_dev = DEVICE_DT_NAME(DT_PHANDLE_BY_IDX(node_id, default_bindings, idx)),          \
        .param1 = COND_CODE_0(DT_PHA_HAS_CELL_AT_IDX(node_id, default_bindings, idx, param1), (0),  \
                              (DT_PHA_BY_IDX(node_id, default_bindings, idx, param1))),             \
        .param2 = COND_CODE_0(DT_PHA_HAS_CELL_AT_IDX(node_id, default_bindings, idx, param2), (0),  \
                              (DT_PHA_BY_IDX(node_id, default_bindings, idx, param2))),             \
    },

/* Always emit at least one entry: a zero-length array is not valid C, and a
 * NULL behavior_dev already reads as "this slot has no default". */
#define GA_DEFAULTS(n)                                                                             \
    COND_CODE_1(DT_INST_NODE_HAS_PROP(n, default_bindings),                                        \
                (LISTIFY(DT_INST_PROP_LEN(n, default_bindings), GA_DEFAULT_ENTRY, (),              \
                         DT_DRV_INST(n))),                                                         \
                ({.behavior_dev = NULL, .param1 = 0, .param2 = 0},))

#define GA_SLOT_NAME(idx, node_id) DT_PROP_BY_IDX(node_id, slot_names, idx),

/* Same one-entry-minimum trick as GA_DEFAULTS: a NULL name reads as "unnamed". */
#define GA_SLOT_NAMES(n)                                                                           \
    COND_CODE_1(DT_INST_NODE_HAS_PROP(n, slot_names),                                              \
                (LISTIFY(DT_INST_PROP_LEN(n, slot_names), GA_SLOT_NAME, (), DT_DRV_INST(n))),      \
                (NULL,))

#define GESTURE_ACTION_INST(n)                                                                     \
    static const struct default_binding gesture_action_defaults_##n[] = {GA_DEFAULTS(n)};          \
    static const char *const gesture_action_slot_names_##n[] = {GA_SLOT_NAMES(n)};                 \
    static const struct behavior_gesture_action_config behavior_gesture_action_config_##n = {      \
        .defaults = gesture_action_defaults_##n,                                                   \
        .defaults_len = ARRAY_SIZE(gesture_action_defaults_##n),                                   \
        .slot_names = gesture_action_slot_names_##n,                                               \
        .slot_names_len = ARRAY_SIZE(gesture_action_slot_names_##n),                               \
    };                                                                                             \
    BEHAVIOR_DT_INST_DEFINE(n, NULL, NULL, NULL, &behavior_gesture_action_config_##n, POST_KERNEL, \
                            CONFIG_KERNEL_INIT_PRIORITY_DEFAULT,                                   \
                            &behavior_gesture_action_driver_api);

DT_INST_FOREACH_STATUS_OKAY(GESTURE_ACTION_INST)

#endif // DT_HAS_COMPAT_STATUS_OKAY(DT_DRV_COMPAT)
