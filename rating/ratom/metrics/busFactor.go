package metrics

// This function uses rest and graphQL through the GITHUB API 
// to collect data pertaining to the BusFactor, then analyzes
// the data and returns a weighted sum of the scores
func BusFactor(jsonRes map[string]interface{}) float32 {

	var disabled float32
	var forking float32
	var visibility float32
	
	// Collected data from the "web_commit_signoff_required" aspect
	if jsonRes["web_commit_signoff_required"].(bool) {
		disabled = .0
	} else {
		disabled = 0.2
	}
	
	// Collected data from the "allow_forking" aspect
	if jsonRes["allow_forking"].(bool) {
		forking = 0.2
	} else {
		forking = 0.4
	}
	
	// Collected data from the "visibility" aspect
	if jsonRes["visibility"].(string) == "public" {
		visibility = .4
	} else {
		visibility = .2
	}

	// Returning weighted sum
	return float32(disabled + forking + visibility)
}
