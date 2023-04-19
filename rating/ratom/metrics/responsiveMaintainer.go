package metrics

import (
	"math"
	"strconv"
	"strings"
	"time"
)

func ResponsiveMaintainer(jsonRes map[string]interface{}) float32 {

	var private float32

	// Getting information for last update
	updatedAt := jsonRes["updated_at"].(string)
	if jsonRes["private"].(bool) {
		private = .1
	} else {
		private = .05
	}

	// Parsing the update data
	updateDateList := strings.Split(updatedAt, "-")
	yearStr := updateDateList[0]
	monthStr := updateDateList[1]

	year, err := strconv.Atoi(yearStr)
	if err != nil {
		panic(err)
	}

	month, err := strconv.Atoi(monthStr)
	if err != nil {
		panic(err)
	}
	monthObj := time.Month(month)

	// Arbitrarily taken from the 15 of the month
	t1 := time.Date(year, monthObj, 15, 0, 0, 0, 0, time.UTC)
	t2 := time.Now()
	diff := t2.Sub(t1)

	var updatedLast float32

	// Scoring the update data based on time ranges
	if 0 < diff.Seconds() && diff.Seconds() <= 604800 { // 7 days timeline
		updatedLast = .25
	} else if diff.Seconds() <= 15720000 { // 1/2 a year timeline
		updatedLast = 0.12
	} else if diff.Seconds() <= 15720000*2 { // 1 year timeline
		updatedLast = 0.06
	} else if diff.Seconds() <= 15720000*2*2 { //2 years timeline
		updatedLast = 0.03
	} else {
		updatedLast = 0
	}

	// Acquring additional data from GITHUB API
	hasIssues := jsonRes["has_issues"].(bool)

	openIssues := jsonRes["open_issues"].(float64)

	issuesScore := 0.0

	if hasIssues {
		issuesScore = 0.35 * math.Min(1, openIssues/350)
	}

	archivedStatus := jsonRes["archived"].(bool)
	archivedScore := 0.0

	if !archivedStatus {
		archivedScore = 0.2
	}

	// Returning weighted sum of aspects
	totalValue := float32(private + updatedLast + float32(issuesScore) + float32(archivedScore))
	return totalValue
}
