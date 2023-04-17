#include "../headers/logger.h"

// Getting the enviornment variables for the log file and the log level 
char* logFile = getenv("LOG_FILE");
char* logLevel = getenv("LOG_LEVEL");

///////////////////////////////////////////
//
//  log_test
//
//  takes in function name as string
//  and status (pass/fail) as int 
//  (0 = pass, 1 = fail)
//
///////////////////////////////////////////
int log_test(std::string function, int status){

    return EXIT_SUCCESS;
}

// Log for entire command test
void log_command(char* command){

}

// Logging function for verbosity 1 
void loggerUpdateOne(char *command){
    FILE *fileptr; 
    fileptr = fopen(logFile, "a");

    // Opens the file and sees if the file is valid
    if (!fileptr){
        fclose(fileptr);
        // If file is not valid the program will exit with an exit failure 
        printf("\nError logging, log file pointer was NULL.");
        exit(EXIT_FAILURE);
    }

    // Gets the current time in order to print it to the logging file 
    time_t t;
    time(&t);
    
    // Puts the correct information in the logging file 
    fputs("Command Successful:    " , fileptr); 
    fputs(ctime(&t), fileptr);
    fputs("Command ran was:       ./run ", fileptr);
    fputs(command , fileptr);

    // Closes the file 
    fclose(fileptr);
}

// Logging function for verbosity 2
void loggerUpdateTwo(char *command, std::vector<std::string> lineNumbers){
    std::string lineN = std::to_string(__LINE__ - 1);

    FILE *fileptr; 
    fileptr = fopen(logFile, "a");
    
    lineN = "Function: loggerUpdateTwo in logger.cpp logging information on line " + lineN;
    lineNumbers.push_back(lineN);

    // Opens the file and sees if the file is valid
    if (!fileptr){
        fclose(fileptr);
        // If file is not valid the program will exit with an exit failure 
        printf("\nError logging, log file pointer was NULL.");
        exit(EXIT_FAILURE);
    }

    // Gets the current time in order to print it to the logging file 
    time_t t;
    time(&t);
    
     // Puts the correct information in the logging file 
    fputs("Command Successful:    " , fileptr); 
    fputs(ctime(&t), fileptr);
    fputs("Command ran was:       ./run ", fileptr);
    fputs(command , fileptr);

    // Begins putting the debugging information into the logger
    fputs("\n\n" , fileptr);
    fputs("________________Debugging Information________________\n", fileptr);

    for (int i = 0; i < lineNumbers.size(); i++){
        // For loop to iterate through the different function calls
        const char* fileStr = lineNumbers[i].c_str();
        // Each function call is put into the file 
        fputs(fileStr, fileptr);
        fputs("\n" , fileptr);
    }

    // Closes the file 
    fclose(fileptr);
}

// Log Error handler 
void logError(int errorType, char* command) {

    FILE *fileptr; 
    fileptr = fopen(logFile, "a");

    // Opens the file and sees if the file is valid
     if (!fileptr){
        fclose(fileptr);
        // If file is not valid the program will exit with an exit failure 
        printf("Error logging, log file pointer was NULL");
        exit(EXIT_FAILURE);
    }

     // Gets the current time in order to print it to the logging file 
    time_t t;
    time(&t);

    // Switch statement to navigate through the different error types 
    switch(errorType){
        case 1: // Invalid run command error 
            fputs("Command Failed:        " , fileptr); 
            fputs(ctime(&t), fileptr);
            fputs("Command ran was:       ./run ", fileptr);
            fputs(command , fileptr);
            fputs("\n\n" , fileptr);
            break;
        default:
            fputs("Unknown error in execution " , fileptr);
            fputs("\n\n" , fileptr);
    }

    fclose(fileptr);
}

int loggerMain(char* command, std::vector<std::string> lineNumbers){

    // Checks the log level and calls the cooresponding function 

    // Log Level 1
    if (atoi(logLevel) == 1){
        loggerUpdateOne(command);
    } else if (atoi(logLevel) == 2) {
        // Log Level 2
        std::string lineN = std::to_string(__LINE__ + 3);
        lineN = "Function: loggerMain  in logger.cpp creating log (verbosity 2) with function loggerUpdateTwo on line " + lineN;
        lineNumbers.push_back(lineN);
        loggerUpdateTwo(command, lineNumbers);
    } 

    return 0;
}