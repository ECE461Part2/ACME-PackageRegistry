// Refer to the following links for error printing and http parsing in Golang used in this file
//https://stackoverflow.com/questions/24809287/how-do-you-get-a-golang-program-to-print-the-line-number-of-the-error-it-just-ca
//https://rakaar.github.io/posts/2021-04-23-go-json-res-parse/

package ratom

import (
	"context"
	"encoding/json"

	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"github.com/shurcooL/githubv4"

	"github.com/go-git/go-git/v5"
	// "github.com/ldiehm/complete_cli/ratom/metrics"
	"ece461-project-cli/ratom/metrics"
	
)

var GITHUB_TOKEN string

type Module struct {
	Url         string
	NetScore    float32
	RampUp      float32
	Correctness float32
	BusFactor   float32
	RespMaint   float32
	VersionPinning_score float32
	CodeReviews_score float32

	License     bool

	
}
//Function to get the GitHub URL from the npmurl input
func getGithubUrl(url string) string {
	before, after, found := strings.Cut(url, "www")
	//Finding endpoints and checking for their existence
	if found {
		npmEndpoint := before + "registry" + after
		npmEndpoint = strings.Replace(npmEndpoint, "com", "org", 1)
		npmEndpoint = strings.Replace(npmEndpoint, "package/", "", 1)

		resp, err := http.Get(npmEndpoint)
		if err != nil {
			return ""
		}

		if resp.StatusCode == http.StatusOK {
			bodyBytes, err := io.ReadAll(resp.Body)

			if err != nil {
				return ""
			}

			bodyString := string(bodyBytes)

			resBytes := []byte(bodyString)
			var npmRes map[string]interface{}
			_ = json.Unmarshal(resBytes, &npmRes)
			
			//Checking for existence of GitHub url
			if npmRes["bugs"] == nil{
				metrics.Functions = append(metrics.Functions, "Module is not hosted on GitHub or link cannot be found on line "+metrics.File_line())
				return ""
			}

			bugs := npmRes["bugs"].(map[string]interface{})
			npmEndpoint = bugs["url"].(string)

			if npmEndpoint == ""{
				return ""
			}

			url = strings.Replace(npmEndpoint, "/issues", "", 1)
		}
	}
	return url
}

//Get the endpoint and turn into https format
func getEndpoint(url string) string {
	index := strings.Index(url, "github")
	url = "https://api." + strings.Replace(url[index:], "/", "/repos/", 1)
	return url
}

func GetToken() string {
	return os.Getenv("GITHUB_TOKEN")
}

func Clone(repo string) string {

	// Temp directory to clone the repository
	if GITHUB_TOKEN == "" {
		GITHUB_TOKEN = GetToken()
	}

	lastIdx := strings.LastIndex(repo, "/")
	dir := "temp/" + repo[lastIdx+1:]

	err := os.MkdirAll(dir, 0777)

	if err != nil {
		log.Fatal(err)
	}

	_, err = git.PlainClone(dir, false, &git.CloneOptions{
		URL:          repo + ".git",
		SingleBranch: false,
		Depth:        1,
	})

	if err != nil {
		metrics.Functions = append(metrics.Functions, "Can't clone "+repo+".git")
		log.Fatal(err)
		return "err"
	}
	return dir
}

//Function to find and analyze the validity of the http url input
func Analyze(url string, client *http.Client) Module {
	//Metric variables
	var busFactor float32
	var responsiveMaintainer float32
	var correctnessScore float32
	var rampUp float32
	var license bool
	var netScore float32
	var versionPinning_score float32
	var codeReviews_score float32

	gitUrl := getGithubUrl(url)

	//Checking for url availability
	if gitUrl == "" {
		metrics.Functions = append(metrics.Functions, "Can't find valid endpoint for input: "+url)
		return Module{url, -1, -1, -1, -1, -1, -1, -1, false}
	}

	dir := Clone(gitUrl)

	endpoint := getEndpoint(gitUrl)
	
	lineNumb := metrics.File_line()
	metrics.Functions = append(metrics.Functions, "Function: getEndpoint called on score.go at line "+lineNumb)

	resp, error := client.Get(endpoint)

	//Error checking for invalid endpoint
	if error != nil {
		metrics.Functions = append(metrics.Functions, "HTTP GET request to  "+endpoint+" returns an error on line "+metrics.File_line())
		return Module{url, -1, -1, -1, -1, -1, -1, -1, false}
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := io.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		// GRAPH QL to get repository information
		owner_map := jsonRes["owner"].(map[string]interface{})

		var Data struct {
			Viewer struct {
				Login string
			}
			Repository struct {
				CommitComments struct {
					TotalCount int
				}
			} `graphql:"repository(owner: $owner, name: $name)"`
		}

		variables := map[string]interface{}{
			"owner": githubv4.String(owner_map["login"].(string)),
			"name":  githubv4.String(jsonRes["name"].(string)),
		}

		graphQLClient := githubv4.NewClient(client)
		error = graphQLClient.Query(context.Background(), &Data, variables)

		
		if error != nil {
			metrics.Functions = append(metrics.Functions, "GraphQL could not create a client in goLang on line "+metrics.File_line())
			Data.Repository.CommitComments.TotalCount = 0
		}


		//Metric function line call with respective metric scores
		correctnessScore = metrics.Correctness(jsonRes)
		lineNumb := metrics.File_line()
		metrics.Functions = append(metrics.Functions, "Function: metrics.Correctness called on score.go at line "+lineNumb)

		busFactor = metrics.BusFactor(jsonRes)
		lineNumb = metrics.File_line()
		metrics.Functions = append(metrics.Functions, "Function: metrics.BusFactor called on score.go at line "+lineNumb)

		rampUp = metrics.RampUp(jsonRes, Data.Repository.CommitComments.TotalCount)
		lineNumb = metrics.File_line()
		metrics.Functions = append(metrics.Functions, "Function: metrics.RampUp called on score.go at line "+lineNumb)

		responsiveMaintainer = metrics.ResponsiveMaintainer(jsonRes)
		lineNumb = metrics.File_line()
		metrics.Functions = append(metrics.Functions, "Function: metrics.ResponsiveMaintainer called on score.go at line "+lineNumb)

		license = metrics.License(dir)
		lineNumb = metrics.File_line()
		metrics.Functions = append(metrics.Functions, "Function: metrics.License called on score.go at line "+lineNumb)

		//NEW STUFF

		versionPinning_score = metrics.VersionPinning(dir)
		lineNumb = metrics.File_line()
		metrics.Functions = append(metrics.Functions, "Function: metrics.versionPinning called on score.go at line "+lineNumb)

		codeReviews_score = metrics.CodeReviews(gitUrl)
		lineNumb = metrics.File_line()
		metrics.Functions = append(metrics.Functions, "Function: metrics.codeReviews called on score.go at line "+lineNumb)

		netScore = metrics.NetScore(correctnessScore, busFactor, rampUp, responsiveMaintainer, license, versionPinning_score, codeReviews_score)
		lineNumb = metrics.File_line()
		metrics.Functions = append(metrics.Functions, "Function: metrics.NetScore called on score.go at line "+lineNumb)
	
		defer os.RemoveAll(dir)

	
		} else {
		//Invalid endpoint
		netScore = -1.0
		rampUp = -1.0
		correctnessScore = -1.0
		busFactor = -1.0
		responsiveMaintainer = -1.0
		license = false
		versionPinning_score = -1.0
		codeReviews_score = -1

		metrics.Functions = append(metrics.Functions, "Invalid endpoint / URL given could not retrieve API data!")
	}

	defer resp.Body.Close()

	m := Module{url, netScore, rampUp, correctnessScore, busFactor, responsiveMaintainer, versionPinning_score, codeReviews_score, license}
	return m
}



