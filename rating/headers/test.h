#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "logger.h"
#include "commands.h"

void build_tests(int* tests_total, int* tests_passed);
void install_tests(int* tests_total, int* tests_passed);
void url_tests(int* tests_total, int* tests_passed, char* filename);
void logger_tests(int* tests_total, int* tests_passed);
int master_test();