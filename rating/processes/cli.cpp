#include "../headers/cli.h"
#include <string>

using namespace std;

int test() {
    return master_test();
}

int main(int argc, char *argv[]) {

    vector<std::string> lineNumbers;
    
    // Gets the enviornment variable
    char* logLevel = getenv("LOG_LEVEL");
    
    // Input must have at least 2 parameters
    if(argc <= 1) {
        exit(EXIT_FAILURE);
    }
    
    // ./run install command 
    if (strcmp(argv[1], "install") == 0){
        std::string lineN = std::to_string(__LINE__ - 1);

        // Install command 
        if(install() == EXIT_FAILURE) {
            exit(EXIT_FAILURE);
            if (atoi(logLevel) != 0){
                logError(1, argv[1]);
            } 
        }

        // If logging level is 2, record the functions that are being called 
        if (atoi(logLevel) == 2){
            lineN = "Function: main in cli.cpp 'install' command called on line " + lineN;
            lineNumbers.push_back(lineN);
            lineN = std::to_string(__LINE__ + 3);
            lineN = "Function: loggerMain being called on " + lineN;
            lineNumbers.push_back(lineN);
        }

        // Call the logger 
        loggerMain(argv[1], lineNumbers);
    }
    // ./run build 
    else if (strcmp(argv[1], "build") == 0){
        std::string lineN = std::to_string(__LINE__ - 1);

        // Build function to be called 
        if(build() == EXIT_FAILURE) {
            if (atoi(logLevel) != 0){
                logError(1, argv[1]);
            } 
            exit(EXIT_FAILURE);
        }

        // If logging level is 2, record the functions that are being called 
        if (atoi(logLevel) == 2){
            lineN = "Function: main in cli.cpp 'build' command called on line " + lineN;
            lineNumbers.push_back(lineN);
            lineN = std::to_string(__LINE__ + 3);
            lineN = "Function: loggerMain being called on " + lineN;
            lineNumbers.push_back(lineN);
        }
        
        // Calls the logger
        loggerMain(argv[1], lineNumbers);
    }

    // Calls the testing suite 
    else if(strcmp(argv[1], "test") == 0) {
        std::string lineN = std::to_string(__LINE__ - 1);

        // Testing suite called 
        if(test() == EXIT_FAILURE) {
            if (atoi(logLevel) != 0){
                logError(1, argv[1]);
            } 
            exit(EXIT_FAILURE);
        }

        // If logging level is 2, record the functions that are being called 
        if (atoi(logLevel) == 2){
            lineN = "Function: main in cli.cpp 'test' command called on line " + lineN;
            lineNumbers.push_back(lineN);
            lineN = std::to_string(__LINE__ + 3);
            lineN = "Function: loggerMain in cli.cpp being called on " + lineN;
            lineNumbers.push_back(lineN);
        }

        // Calls the logger 
        loggerMain(argv[1], lineNumbers);
    }
    else {
        // Validating file name input - changed by Luke Diehm on 3/2

        string input = argv[1];
        // FILE *fileptr; 
        // fileptr = fopen(argv[1], "r");

        // if (!fileptr) {
        //     free(fileptr);
        //     fprintf(stdout, "Command did not match any of the following: \n./run build\n./run install\n./run URL_FILE");
        //     fprintf(stdout, "\nor the file could not be found in the given path."); 

        //     if (atoi(logLevel) != 0){
        //         logError(1, argv[1]);
        //     } 
        //     exit(EXIT_FAILURE);
        // }

        // Perform running 
        // fclose(fileptr);

        // Running file analysis
        std::string lineN = std::to_string(__LINE__ - 1); 

        // Calling logger to log the command that was just run
        char *runURL = (char *)"RUN_URL";
        
         if (atoi(logLevel) == 2){
            lineN = "Function: main in cli.cpp 'test' command called on line " + lineN;
            lineNumbers.push_back(lineN);
            lineN = std::to_string(__LINE__ + 3);
            lineN = "Function: loggerMain in cli.cpp being called on " + lineN;
            lineNumbers.push_back(lineN);
        }
        loggerMain(runURL, lineNumbers);

        url(argv[1]);   
    }
     
    exit(EXIT_SUCCESS);
}
