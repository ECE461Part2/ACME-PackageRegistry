package metrics

import (
	"math"
)

// This function uses rest and graphQL through the GITHUB API
// to collect data pertaining to the Correctness factor, then analyzes
// the data and returns a weighted sum of the scores
func Correctness(jsonRes map[string]interface{}) float32 {

	ownerType := 0.0
	webCommit := 0.0

	// Collecting data from API
	stargazers := jsonRes["stargazers_count"].(float64)
	forksNum := jsonRes["forks_count"].(float64)

	// Analysis of owner type
	owner_map := jsonRes["owner"].(map[string]interface{})
	if owner_map["type"].(string) == "Organization" {
		ownerType = .15
	} else {
		ownerType = .07
	}

	// Analysis of web_commit_signoff_required
	if jsonRes["web_commit_signoff_required"].(bool) {
		webCommit = .1
	} else {
		webCommit = 0.05
	}

	// Assigning weights to stargazers
	if stargazers >= 10000 {
		stargazers = 0.25
	} else if stargazers >= 1000 {
		stargazers = 0.2
	} else if stargazers >= 500 {
		stargazers = 0.15
	} else {
		stargazers = 0.05
	}

	// Assigning weights to forks
	if forksNum >= 10000 {
		forksNum = 0.35
	} else if forksNum >= 1000 {
		forksNum = 0.3
	} else if forksNum >= 100 {
		forksNum = 0.2
	} else if forksNum >= 50 {
		forksNum = 0.15
	} else if forksNum >= 25 {
		forksNum = 0.1
	} else {
		forksNum = 0.05
	}

	total := math.Max(0.1, ownerType+webCommit+stargazers+forksNum)

	return float32(total)
}