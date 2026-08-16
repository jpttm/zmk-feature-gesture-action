/*
 * Copyright (c) 2026 jpttm
 *
 * SPDX-License-Identifier: MIT
 */

#include <pb_decode.h>
#include <pb_encode.h>

#include <jpttm/gesture_action/gesture_action.pb.h>
#include <zmk/behaviors/gesture_action.h>
#include <zmk/studio/custom.h>
#include <zmk/keymap.h>

#if IS_ENABLED(CONFIG_ZMK_GESTURE_ACTION_LAYER_GROUPS)
#include <zmk/mouse_gesture.h>
#endif

#include <zephyr/logging/log.h>
#include <stdio.h>
#include <string.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

/* Where the settings UI is served from. The firmware advertises these, so a
 * Studio client knows where to load the page for this subsystem. The localhost
 * entry is for `npm run dev` against a real keyboard. */
static struct zmk_rpc_custom_subsystem_meta gesture_action_meta = {
    ZMK_RPC_CUSTOM_SUBSYSTEM_UI_URLS("https://jpttm.github.io/zmk-feature-gesture-action/",
                                     "http://localhost:5173"),
    /* Reading is harmless, but reassigning a gesture can type anything, so the
     * whole subsystem sits behind an unlocked Studio session. */
    .security = ZMK_STUDIO_RPC_HANDLER_SECURED,
};

ZMK_RPC_CUSTOM_SUBSYSTEM(jpttm__gesture_action, &gesture_action_meta,
                         gesture_action_rpc_handle_request);

ZMK_RPC_CUSTOM_SUBSYSTEM_RESPONSE_BUFFER(jpttm__gesture_action, jpttm_gesture_action_Response);

static int handle_get_actions(const jpttm_gesture_action_GetActionsRequest *req,
                              jpttm_gesture_action_Response *resp) {
    jpttm_gesture_action_GetActionsResponse result =
        jpttm_gesture_action_GetActionsResponse_init_zero;

    const uint8_t total = zmk_gesture_action_count();
    const size_t page = ARRAY_SIZE(result.actions);

    result.total_slots = total;
    result.start_slot = req->start_slot;

    for (uint32_t slot = req->start_slot; slot < total && result.actions_count < page; slot++) {
        struct zmk_gesture_action_entry entry;
        if (zmk_gesture_action_get((uint8_t)slot, &entry) != 0) {
            break;
        }

        result.actions[result.actions_count++] = (jpttm_gesture_action_Action){
            .slot = slot,
            .behavior_id = entry.behavior_local_id,
            .param1 = entry.param1,
            .param2 = entry.param2,
        };
    }

    resp->which_response_type = jpttm_gesture_action_Response_get_actions_tag;
    resp->response_type.get_actions = result;
    return 0;
}

static int handle_get_defaults(const jpttm_gesture_action_GetDefaultsRequest *req,
                               jpttm_gesture_action_Response *resp) {
    jpttm_gesture_action_GetDefaultsResponse result =
        jpttm_gesture_action_GetDefaultsResponse_init_zero;

    const uint8_t total = zmk_gesture_action_count();
    const size_t page = ARRAY_SIZE(result.actions);

    result.total_slots = total;
    result.start_slot = req->start_slot;

    for (uint32_t slot = req->start_slot; slot < total && result.actions_count < page; slot++) {
        struct zmk_gesture_action_entry entry = {0};
        /* A slot with no default reports behavior_id 0, same as an unassigned
         * one - the client renders both as "nothing happens". */
        zmk_gesture_action_default((uint8_t)slot, &entry);

        result.actions[result.actions_count++] = (jpttm_gesture_action_Action){
            .slot = slot,
            .behavior_id = entry.behavior_local_id,
            .param1 = entry.param1,
            .param2 = entry.param2,
        };
    }

    resp->which_response_type = jpttm_gesture_action_Response_get_defaults_tag;
    resp->response_type.get_defaults = result;
    return 0;
}

static int handle_get_slot_names(const jpttm_gesture_action_GetSlotNamesRequest *req,
                                 jpttm_gesture_action_Response *resp) {
    jpttm_gesture_action_GetSlotNamesResponse result =
        jpttm_gesture_action_GetSlotNamesResponse_init_zero;

    const uint8_t total = zmk_gesture_action_count();
    const size_t page = ARRAY_SIZE(result.names);

    result.total_slots = total;
    result.start_slot = req->start_slot;

    for (uint32_t slot = req->start_slot; slot < total && result.names_count < page; slot++) {
        const char *name = zmk_gesture_action_name((uint8_t)slot);
        /* An unnamed slot still occupies a position, so the client can index
         * the array by offset rather than having to match slots up. */
        snprintf(result.names[result.names_count], sizeof(result.names[0]), "%s",
                 name ? name : "");
        result.names_count++;
    }

    resp->which_response_type = jpttm_gesture_action_Response_get_slot_names_tag;
    resp->response_type.get_slot_names = result;
    return 0;
}

#if IS_ENABLED(CONFIG_ZMK_GESTURE_ACTION_LAYER_GROUPS)

static int handle_get_groups(jpttm_gesture_action_Response *resp) {
    jpttm_gesture_action_GetGroupsResponse result =
        jpttm_gesture_action_GetGroupsResponse_init_zero;

    const uint8_t total = zmk_mouse_gesture_count();
    const size_t max = ARRAY_SIZE(result.groups);

    for (uint8_t i = 0; i < total && result.groups_count < max; i++) {
        jpttm_gesture_action_Group *group = &result.groups[result.groups_count++];
        group->index = i;
        group->active_layers = zmk_mouse_gesture_get_active_layers(i);

        const char *name = zmk_mouse_gesture_name(i);
        snprintf(group->name, sizeof(group->name), "%s", name ? name : "");
    }

    if (total > max) {
        LOG_WRN("Reporting %d of %d gesture groups", (int)max, total);
    }

    /* What the UI needs to build the layer picker for *this* board rather than
     * carrying one keyboard's layer numbers in its source. */
    result.layer_count = ZMK_KEYMAP_LAYERS_LEN;
    result.reserved_layers = zmk_gesture_action_reserved_layers();

    resp->which_response_type = jpttm_gesture_action_Response_get_groups_tag;
    resp->response_type.get_groups = result;
    return 0;
}

static int handle_set_group_layers(const jpttm_gesture_action_SetGroupLayersRequest *req,
                                   jpttm_gesture_action_Response *resp) {
    int rc = zmk_mouse_gesture_set_active_layers((uint8_t)req->index, req->active_layers,
                                                 req->persist);
    if (rc == -EINVAL) {
        LOG_WRN("SetGroupLayers for unknown group %u", req->index);
        return rc;
    }

    jpttm_gesture_action_SetGroupLayersResponse result =
        jpttm_gesture_action_SetGroupLayersResponse_init_zero;
    result.success = (rc == 0);

    resp->which_response_type = jpttm_gesture_action_Response_set_group_layers_tag;
    resp->response_type.set_group_layers = result;
    return 0;
}

#endif // IS_ENABLED(CONFIG_ZMK_GESTURE_ACTION_LAYER_GROUPS)

static int handle_set_action(const jpttm_gesture_action_SetActionRequest *req,
                             jpttm_gesture_action_Response *resp) {
    if (!req->has_action) {
        LOG_WRN("SetAction without an action");
        return -EINVAL;
    }

    const struct zmk_gesture_action_entry entry = {
        .behavior_local_id = (zmk_behavior_local_id_t)req->action.behavior_id,
        .param1 = req->action.param1,
        .param2 = req->action.param2,
    };

    int rc = zmk_gesture_action_set((uint8_t)req->action.slot, &entry, req->persist);
    if (rc == -EINVAL) {
        LOG_WRN("SetAction for out-of-range slot %u", req->action.slot);
        return rc;
    }

    jpttm_gesture_action_SetActionResponse result = jpttm_gesture_action_SetActionResponse_init_zero;
    result.success = (rc == 0);

    resp->which_response_type = jpttm_gesture_action_Response_set_action_tag;
    resp->response_type.set_action = result;
    return 0;
}

static int handle_reset_action(const jpttm_gesture_action_ResetActionRequest *req,
                               jpttm_gesture_action_Response *resp) {
    int rc = zmk_gesture_action_reset((uint8_t)req->slot, req->persist);
    if (rc == -EINVAL) {
        LOG_WRN("ResetAction for out-of-range slot %u", req->slot);
        return rc;
    }

    jpttm_gesture_action_ResetActionResponse result =
        jpttm_gesture_action_ResetActionResponse_init_zero;
    result.success = (rc == 0);

    resp->which_response_type = jpttm_gesture_action_Response_reset_action_tag;
    resp->response_type.reset_action = result;
    return 0;
}

static void fail(jpttm_gesture_action_Response *resp, const char *message) {
    jpttm_gesture_action_ErrorResponse err = jpttm_gesture_action_ErrorResponse_init_zero;
    snprintf(err.message, sizeof(err.message), "%s", message);
    resp->which_response_type = jpttm_gesture_action_Response_error_tag;
    resp->response_type.error = err;
}

static bool gesture_action_rpc_handle_request(const zmk_custom_CallRequest *raw_request,
                                              pb_callback_t *encode_response) {
    jpttm_gesture_action_Response *resp =
        ZMK_RPC_CUSTOM_SUBSYSTEM_RESPONSE_BUFFER_ALLOCATE(jpttm__gesture_action, encode_response);

    jpttm_gesture_action_Request req = jpttm_gesture_action_Request_init_zero;
    pb_istream_t stream =
        pb_istream_from_buffer(raw_request->payload.bytes, raw_request->payload.size);

    if (!pb_decode(&stream, jpttm_gesture_action_Request_fields, &req)) {
        LOG_WRN("Failed to decode gesture action request: %s", PB_GET_ERROR(&stream));
        fail(resp, "Failed to decode request");
        return true;
    }

    int rc;
    switch (req.which_request_type) {
    case jpttm_gesture_action_Request_get_actions_tag:
        rc = handle_get_actions(&req.request_type.get_actions, resp);
        break;
    case jpttm_gesture_action_Request_set_action_tag:
        rc = handle_set_action(&req.request_type.set_action, resp);
        break;
    case jpttm_gesture_action_Request_reset_action_tag:
        rc = handle_reset_action(&req.request_type.reset_action, resp);
        break;
    case jpttm_gesture_action_Request_get_defaults_tag:
        rc = handle_get_defaults(&req.request_type.get_defaults, resp);
        break;
    case jpttm_gesture_action_Request_get_slot_names_tag:
        rc = handle_get_slot_names(&req.request_type.get_slot_names, resp);
        break;
#if IS_ENABLED(CONFIG_ZMK_GESTURE_ACTION_LAYER_GROUPS)
    case jpttm_gesture_action_Request_get_groups_tag:
        rc = handle_get_groups(resp);
        break;
    case jpttm_gesture_action_Request_set_group_layers_tag:
        rc = handle_set_group_layers(&req.request_type.set_group_layers, resp);
        break;
#endif
    default:
        LOG_WRN("Unsupported gesture action request type: %d", req.which_request_type);
        fail(resp, "Unsupported request");
        return true;
    }

    if (rc == -EINVAL) {
        fail(resp, "Slot out of range");
    } else if (rc != 0) {
        fail(resp, "Failed to process request");
    }

    return true;
}
