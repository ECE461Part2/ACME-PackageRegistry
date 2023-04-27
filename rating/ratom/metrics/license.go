package metrics

import (
	"bufio"
	"os"
	"regexp"
)


// Parsing through readme and collecting data pertaining to Licensing of repo
func License(directory string) bool {
	

	// Opening readme
	file, err := os.Open(directory + "/package.json")
	if err != nil {
		panic(err)
	}
	defer file.Close()

	// Using regex to check for license
	scanner := bufio.NewScanner(file)
	re := regexp.MustCompile(`(?i)license`)

	licenses := [9]string{"MIT", "LGPLv2.1", "Expat", "X11", "MPL-2.0", "Mozilla Public", "Artistic License 2", "GPLv2", "GPLv3"}
	for scanner.Scan() {

		text := scanner.Text()
	// String matching for license names
		for j := 0; j < len(licenses); j++ {
			re = regexp.MustCompile("(?i)" + licenses[j])
			if (re.MatchString(text)) {
				return true
			}
		}

	
}
return false
}