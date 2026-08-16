/*
 * Copyright (c) 2026 jpttm
 *
 * SPDX-License-Identifier: MIT
 */

#pragma once

#include <stdint.h>
#include <zmk/behavior.h>

/** Local ID value used to mean "this slot has nothing stored". */
#define ZMK_GESTURE_ACTION_UNSET 0

/** What a single slot holds: enough to rebuild a zmk_behavior_binding. */
struct zmk_gesture_action_entry {
    zmk_behavior_local_id_t behavior_local_id;
    uint32_t param1;
    uint32_t param2;
};

/**
 * @brief Layers the board has reserved, as a bitmask.
 *
 * Set from the reserved-layers devicetree property. A configuration UI should
 * leave these out of the layers it offers for gestures. Zero means the board
 * has reserved nothing.
 */
uint32_t zmk_gesture_action_reserved_layers(void);

/**
 * @brief Read the action currently assigned to a slot.
 *
 * Reports the stored assignment only. A slot with nothing stored reads back as
 * ZMK_GESTURE_ACTION_UNSET even when a devicetree default will run in its
 * place, so a configuration UI can tell "left at the default" apart from
 * "deliberately set to this".
 *
 * @retval 0 on success.
 * @retval -EINVAL if @p slot is out of range.
 */
int zmk_gesture_action_get(uint8_t slot, struct zmk_gesture_action_entry *out);

/**
 * @brief Assign an action to a slot.
 *
 * @param persist Write the assignment to settings as well as applying it. Pass
 *                false to try something out without spending a flash write.
 *
 * @retval 0 on success.
 * @retval -EINVAL if @p slot is out of range.
 * @retval Negative errno from the settings layer if persisting failed. The
 *         in-memory assignment is applied regardless.
 */
int zmk_gesture_action_set(uint8_t slot, const struct zmk_gesture_action_entry *entry,
                           bool persist);

/**
 * @brief Drop a slot's stored assignment, returning it to its devicetree default.
 *
 * @retval 0 on success.
 * @retval -EINVAL if @p slot is out of range.
 */
int zmk_gesture_action_reset(uint8_t slot, bool persist);

/**
 * @brief The devicetree fallback for a slot: what runs when nothing is stored.
 *
 * Lets a UI show the actual action rather than the word "default".
 *
 * @retval 0 on success.
 * @retval -EINVAL if @p slot is out of range.
 * @retval -ENOENT if the slot has no devicetree default.
 */
int zmk_gesture_action_default(uint8_t slot, struct zmk_gesture_action_entry *out);

/** @brief How many slots this build has, i.e. CONFIG_ZMK_GESTURE_ACTION_COUNT. */
uint8_t zmk_gesture_action_count(void);

/**
 * @brief The devicetree label for a slot, for UIs to show instead of a number.
 *
 * @retval NULL when the slot has no label, in which case a caller should fall
 *         back to the slot number.
 */
const char *zmk_gesture_action_name(uint8_t slot);
