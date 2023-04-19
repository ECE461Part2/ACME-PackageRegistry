#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <string>
#include <iostream>
#include <vector>
#include <cstring>

#define PASS 0
#define FAIL 1

int log_test(std::string, int);
void log_command(char* command);
void loggerUpdateOne(char *command);
void loggerUpdateTwo(char *command, std::vector<std::string> lineNumbers);
void logError(int errorType, char* command);
int loggerMain(char *command, std::vector<std::string> lineNumbers);
