idf_component_register(SRCS "main.cpp"
                        "../managed_components/knolleary__PubSubClient/src/PubSubClient.cpp"
                    INCLUDE_DIRS "."
                        "../managed_components/knolleary__PubSubClient/src"
                    REQUIRES arduino-esp32 arduinojson)
