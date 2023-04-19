package ratom

import (
	"fmt"
	"log"
	"os"
	"ece461-project-cli/ratom/metrics"

	// "github.com/ldiehm/complete_cli/ratom/metrics"
)

func LoggerVerbOne(output []Module) {

	// Variable to get the name of the LOG_FILE from enviornment variables
	logPath := os.Getenv("LOG_FILE")

	// Opens the file in append mode 
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)

	// Error checking for opening the file 
	if err != nil {
		fmt.Println("GoLang could not find logging file!")
		panic(err)
	}

	// Closes the link with the file 
	defer f.Close()

	// Ensures that there are no prefixes or automatic time stamps on the log lines to prevent cluttering 
	log.SetOutput(f)
	log.SetPrefix("")
	log.SetFlags(0)

	// Prints the output of the ./run_URL to the log file 
	log.Printf("\n")
	log.Printf("\nOutput:\n")
	for a := 0; a < len(output); a++ {
		log.Println(output[a])
	}
	log.Printf("\n")
	log.Printf("\n")
}

func LoggerVerbTwo(output []Module) {

	// Variable to get the name of the LOG_FILE from enviornment variables
	logPath := os.Getenv("LOG_FILE")

	// Opens the file in append mode 
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)

	// Error checking for opening the file 
	if err != nil {
		fmt.Println("GoLang could not find logging file!")
		panic(err)
	}

	// Closes the link with the file 
	defer f.Close()

	// Ensures that there are no prefixes or automatic time stamps on the log lines to prevent cluttering 
	log.SetOutput(f)
	log.SetPrefix("")
	log.SetFlags(0)

	// Prints the various function calls and/or error messages along the way to the output 
	for a := 0; a < len(metrics.Functions); a++ {

		// For loop iterates through the list to print the output for each URL 
		log.Println(metrics.Functions[a])
	}

	// Prints the output of the ./run_URL to the log file 
	log.Printf("\nOutput:\n")
	for a := 0; a < len(output); a++ {
		log.Println(output[a])
	}
	log.Printf("\n")
	log.Printf("\n")
}
