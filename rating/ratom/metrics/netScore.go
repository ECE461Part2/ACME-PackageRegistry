package metrics

import (
	"fmt"
	"runtime"
	"strings"
)

var Functions []string

// Auxillary function used for logging (Cited in Report)
func File_line() string {
	_, fileName, fileLine, ok := runtime.Caller(1)
	var s string
	if ok {
		s = fmt.Sprintf("%s:%d", fileName, fileLine)
	} else {
		s = ""
	}

	fileInfo := strings.Split(s, ":")
	fileInfoSize := len(fileInfo)
	return fileInfo[fileInfoSize-1]
}

// Combining the weighted sum of the analyzed factors
func NetScore(correctness float32, busFactor float32, rampUp float32, responsiveness float32, license bool, versionPinning_score float32, codeReviews_score float32) float32 {
	return float32(.25*correctness + .15*responsiveness + .15*busFactor + .15*rampUp + .15*versionPinning_score + .15*codeReviews_score)
}
