idf_component_register(
    SRCS "main.c"
    INCLUDE_DIRS "."
    REQUIRES nvs_flash esp_wifi esp_event espressif__mqtt espressif__cjson driver esp_driver_gpio)