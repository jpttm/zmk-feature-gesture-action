zephyr_include_directories(include)
if(CONFIG_ZMK_GESTURE_ACTION)
    target_sources(app PRIVATE src/behaviors/behavior_gesture_action.c)
endif()
