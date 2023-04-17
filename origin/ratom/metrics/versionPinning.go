package metrics


import (
	"fmt"
	"os"
	"regexp"
	"strings"
)


func VersionPinning(gitDir string) float32 {
    
        data, err := os.ReadFile(gitDir + "/package.json")
        if err != nil {
            fmt.Println("Didn't find package.json file")
            return 0
        }

        regex_getAllDependencies, _ := regexp.Compile("\"dependencies\": {([^}]*)")
        regex_getIndividualDependencies, _ := regexp.Compile("(\".*\"): \"(.*)\"")
        regex_getVersion, _ := regexp.Compile("(^\\^[1-9])|(^[0-9]$)|(^[0-9].*-[0-9].*$)|(^[0-9].x$)|(^~[0-9]$)")

        total := 0
        count_good_dependency := 0

        result := regex_getAllDependencies.FindStringSubmatch(string(data))

        if len(result) == 0{
            return 1
        }
        res := strings.Split(result[1], "\n")

        for j := 0; j < len(res); j++ {

            curr := regex_getIndividualDependencies.FindStringSubmatch(res[j])

            if len(curr) == 3{
                total += 1
                if regex_getVersion.MatchString(curr[2]) {
                    count_good_dependency += 1
                }
            }
            
        } 
        
        if total == 0{
            return float32(1)
        }
        score := float32(count_good_dependency) / float32(total)
        
        return score
}