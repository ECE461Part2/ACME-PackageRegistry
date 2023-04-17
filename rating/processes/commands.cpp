#include "../headers/commands.h"

// Function to be used for build command
int build() {
    //system("cd processes");
    system("export $(cat .env | xargs)");
    system("g++ processes/*.cpp -o run");
    //system("bash processes/buildRun.sh");
    return (EXIT_SUCCESS);
}
// Function to be used for install command
int install() {
    system("go get .");
    return (EXIT_SUCCESS);
}

// Function to be used for url command
int url(char* file) {
    std::string str1 = (std::string) "go run main.go ";
    int check = system((str1 + (std::string) file).c_str());

    if (check != 0){
        exit (EXIT_FAILURE);
    }

    return (EXIT_SUCCESS);
}