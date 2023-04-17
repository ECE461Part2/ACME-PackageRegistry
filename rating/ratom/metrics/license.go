package metrics

import (
	"bufio"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var readme string

// https://stackoverflow.com/questions/71153302/how-to-set-depth-for-recursive-iteration-of-directories-in-filepath-walk-func
// Performing a recursive iteration of directories in filepath using a walk function to find readme
func walk(path string, d fs.DirEntry, err error) error {
	maxDepth := 1
	if (err != nil) {
		return err
	} 
	if d.IsDir() && strings.Count(path, string(os.PathSeparator)) > maxDepth {
		return fs.SkipDir
	} else {
		// Checking paths
		matched, _ := regexp.MatchString(`(?i)readme`, path)
		if (matched) {
			// Checking matched path
			check, _ := regexp.MatchString("(?i)guid", path)
			if !check {
				// Finding readme
				readme = path
			}
		}
	}
	return nil
}

// Parsing through readme and collecting data pertaining to Licensing of repo
func License(directory string) bool {
	
	// store array of strings of lines that contain the word license
	var text []string

	// Finding readme in directory
	err := filepath.WalkDir(directory, walk)
	if err != nil {
		Functions = append(Functions, "Error while trying to find ReadMe in " + directory)
		return false
	}

	// Error handling readme
	if readme == "" {
		Functions = append(Functions, "ReadMe could be found in " + directory)
		return false
	}

	// Opening readme
	file, err := os.Open(readme)
	if err != nil {
		panic(err)
	}
	defer file.Close()

	// Using regex to check for license
	scanner := bufio.NewScanner(file)
	re := regexp.MustCompile(`(?i)license`)
	for scanner.Scan() {
		line := scanner.Bytes()
		if (re.Match(line)) {
			text = append(text, string(line))
		}
	}
	licenses := [9]string{"MIT", "LGPLv2.1", "Expat", "X11", "MPL-2.0", "Mozilla Public", "Artistic License 2", "GPLv2", "GPLv3"}

	// String matching for license names
	for i := 0; i < len(text); i++ {
		//fmt.Println(text[i])
		for j := 0; j < len(licenses); j++ {
			re = regexp.MustCompile("(?i)" + licenses[j])
			if (re.MatchString(text[i])) {
				return true
			}
		}
	}

	return false
}
