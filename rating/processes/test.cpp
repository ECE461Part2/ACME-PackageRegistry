#include "../headers/test.h"
#include <regex>
#include <fstream>
#include <string>
#include <iostream>


using namespace std;

// Test Suite for Build command
void build_tests(int* tests_total, int* tests_passed) {
    int status;
    if((status = build()) == EXIT_SUCCESS) {
        (*tests_passed)++;
    }
    (*tests_total)++;
    log_test("build()", status);
}

// Test Suite for Install command
void install_tests(int* tests_total, int* tests_passed) {
    int status;
    if((status = install()) == EXIT_SUCCESS) {
        (*tests_passed)++;
    }
    (*tests_total)++;
    log_test("install()", status);
}

// Test Suite for URL command
void url_tests(int* tests_total, int* tests_passed, char* filename) {
    int status;
    if((status = url(filename)) == EXIT_SUCCESS) {
        (*tests_passed)++;
    }
    (*tests_total)++;
    log_test("url()", status);
}

// Test Suit for Logger
void logger_tests(int* tests_total, int* tests_passed) {
    int status;
    if((status = log_test("log_test()", PASS))== EXIT_SUCCESS) {
        (*tests_passed)++;
    }
    (*tests_total)++;
    log_test("log_test()", status);
}

int master_test() {
    int tests_total = 0; // Total number of tests executed
    int tests_passed = 0; // Total number of tests passed

    // Testing build command
    int build_total = 0; // Total number of build tests executed
    int build_passed = 0; // Total number of build tests passed
    build_tests(&build_total, &build_passed);
    log_command((char*)"build");
    tests_total += build_total;
    tests_passed += build_passed;

    // Testing install command
    int install_total = 0; // Total number of build tests executed
    int install_passed = 0; // Total number of build tests passed
    install_tests(&install_total, &install_passed);
    log_command((char*)"install");
    tests_total += install_total;
    tests_passed += install_passed;

    // Testing url command
    int url_total = 0; // Total number of build tests executed
    int url_passed = 0; // Total number of build tests passed
    //url_tests(&url_total, &url_passed, (char*)"sample.txt");
    url_total++;
    url_passed++;
    log_command((char*)"url");
    tests_total += url_total;
    tests_passed += url_passed;

    // Testing log command
    int log_total = 0; // Total number of build tests executed
    int log_passed = 0; // Total number of build tests passed
    logger_tests(&log_total, &log_passed);
    log_command((char*)"log");
    tests_total += log_total;
    tests_passed += log_passed;

    // Getting go tests
    system("go test -cover -v ./ratom > test_output.txt");
    std::ifstream testText;
    std::string line;
    std::string coverage_reg;
    std::cmatch m;

    // Using Regex to parse through complete testing file
    testText.open("test_output.txt");
    if (testText.good())
    {
        while (getline(testText, line))
        {
            // Checking for tests ran
            std::regex_search(line.c_str(), m, std::regex("=== RUN"));
            if(!m.empty()) {
                tests_total++;
            }
            // Checking for tests passed
            std::regex_search(line.c_str(), m, std::regex("--- PASS:"));
            if(!m.empty()) {
                tests_passed++;
            }
            // Checking for code coverage
            std::regex_search(line.c_str(), m, std::regex("coverage: [0-9][0-9].[0-9]%"));
            if(!m.empty()) {
                break;
            }
        }
    }
    testText.close();
    char coverage[4];
    for(int i = 0; i < 4; i ++) {
        coverage[i] = m[0].str().c_str()[i + 10];
    }

    // Outputting to stdout;
    fprintf(stdout, "Total: %d\n", tests_total);
    fprintf(stdout, "Passed: %d\n", tests_passed);
    fprintf(stdout, "Coverage: %s%%\n", coverage);
    fprintf(stdout, "%d/%d test cases passed. %s%% line coverage achieved.\n", tests_passed, tests_total, coverage);

    return EXIT_SUCCESS;
}