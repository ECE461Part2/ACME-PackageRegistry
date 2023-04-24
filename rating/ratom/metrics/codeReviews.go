package metrics

import (
	// "fmt"
	"bufio"
	"fmt"
	"os"
	"strconv"

	"github.com/estebangarcia21/subprocess"
)

func CodeReviews(gitUrl string) float32 {
	command := "python3 ratom/metrics/CR_Score.py " + gitUrl
	r := subprocess.New(command, subprocess.Shell)
	r.Exec()

	file, err := os.Open("CR_Score.txt")
	if err != nil {
		fmt.Println("Couldn't find CR_Score.txt")
		return 0
	}

	// create scanner to scan file
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		// reads string in score txt, converts to float64
		s := scanner.Text()
		score, err := strconv.ParseFloat(s, 64)
		// if error return 0 as score and remove file, otherwise return score
		if err != nil {
			e2 := file.Close()
			if e2 != nil {
				fmt.Println("Couldn't Close File CR_Score.txt")
			}
			fmt.Println("Conversion of string to float didn't work.")
			e := os.Remove("CR_Score.txt")
			if e != nil {
				fmt.Println("Didn't find CR_Score.txt")
			}
			return 0
		} else {
			e2 := file.Close()
			if e2 != nil {
				fmt.Println("Couldn't Close File CR_Score.txt")
			}
			e := os.Remove("CR_Score.txt")
			if e != nil {
				fmt.Println("Didn't find CR_Score.txt")
			}
			return float32(score)
		}
	}

	e2 := file.Close()
	if e2 != nil {
		fmt.Println("Couldn't Close File CR_Score.txt")
	}
	e := os.Remove("CR_Score.txt")
	if e != nil {
		fmt.Println("Didn't find CR_Score.txt")
	}

	return 0

}
