package ratom

import (
	"testing"
	"fmt"
	"golang.org/x/oauth2"
	"os"
	"context"
	"io/ioutil"
	"encoding/json"
	"net/http"
	"github.com/paingp/ece461-project-cli/ratom/metrics"
)

var file = "https://github.com/lodash/lodash"

// Testing analyzer with basic github link
func TestAnalyze(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	module := Analyze(file, httpClient)
	os.RemoveAll("temp")
	var modules []Module
	modules = append(modules, module)
	LoggerVerbOne(modules)
	LoggerVerbTwo(modules)

	if(module.License == false) {
		fmt.Printf("No License")
	}
}

var file2 = "https://www.npmjs.com/package/browserify"

// Testing analyzer with npm link
func TestAnalyzeNPM(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	module := Analyze(file2, httpClient)
	os.RemoveAll("temp")
	var modules []Module
	modules = append(modules, module)
	LoggerVerbOne(modules)
	LoggerVerbTwo(modules)

	if(module.License == false) {
		fmt.Printf("Cannot find license")
	}
}

var file3 = "https://www.npmjs.com/package/linalg.js"

// Testing analyzer with an NPM link that does not have a github link
func TestAnalyzeNoGithub(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	module := Analyze(file3, httpClient)
	os.RemoveAll("temp")
	var modules []Module
	modules = append(modules, module)
	LoggerVerbOne(modules)
	LoggerVerbTwo(modules)

	if(module.NetScore != -1) {
		t.Fatalf("Incorrectly parsed")
	}
}

var file4 = "www.google.com"

// Testing analyzer with link from invalid domain
func TestAnalyzeGoogle(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	module := Analyze(file4, httpClient)
	os.RemoveAll("temp")
	var modules []Module
	modules = append(modules, module)
	LoggerVerbOne(modules)
	LoggerVerbTwo(modules)

	if(module.NetScore != -1) {
		t.Fatalf("Incorrectly parsed")
	}
}

var endpoint = "https://api.github.com/repos/cloudinary/cloudinary_npm"
var endpoint2 = "https://api.github.com/repos/ben-ng/add"
var endpoint3 = "https://api.github.com/repos/axios/axios"
var endpoint4 = "https://api.github.com/repos/campb474/ECE368"


// Tests 1 - 6
// Testing busFactor on github link
func TestBusFactor(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var bus = metrics.BusFactor(jsonRes)

		if bus < 0 || bus > 1 {
			t.Fatalf("Bus is out of range")
		}
	}

	defer resp.Body.Close()
}

// Testing correctness on github link
func TestCorrectness(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var cor = metrics.Correctness(jsonRes)


		if cor < 0 || cor > 1 {
			t.Fatalf("Correctness is out of range")
		}
	}

	defer resp.Body.Close()
}

// Testing rampup on github link
func TestRampUp(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var ramp = metrics.RampUp(jsonRes, 3)


		if ramp < 0 || ramp > 1 {
			t.Fatalf("Ramp Up is out of range")
		}
	}

	defer resp.Body.Close()
}

// Testing responsive maintainer on github link
func TestResponsiveMaintainer(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var resp = metrics.ResponsiveMaintainer(jsonRes)

		if resp < 0 || resp > 1 {
			t.Fatalf("Responsive Maintainer is out of range")
		}
	}

	defer resp.Body.Close()
}

// Testing the net score function
func TestNetScore(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var bus = metrics.BusFactor(jsonRes)
		var cor = metrics.Correctness(jsonRes)
		var ramp = metrics.RampUp(jsonRes, 20)
		var resp = metrics.ResponsiveMaintainer(jsonRes)
		var net = metrics.NetScore(cor, bus, ramp, resp, false)

		if net < 0 || net > 1 {
			t.Fatalf("Net Score is out of range")
		}
	}

	defer resp.Body.Close()
}

// Tests 6 - 12
// Testing busfactor with secondary link
func TestBusFactor2(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint2)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var bus = metrics.BusFactor(jsonRes)

		if bus < 0 || bus > 1 {
			t.Fatalf("Bus is out of range")
		}
	}

	defer resp.Body.Close()
}

// Testing Correctness with secondary link
func TestCorrectness2(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint2)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var cor = metrics.Correctness(jsonRes)

		if cor < 0 || cor > 1 {
			t.Fatalf("Correctness is out of range")
		}
	}

	defer resp.Body.Close()
}

// Testing Ramp Up time with secondary link
func TestRampUp2(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint2)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var ramp = metrics.RampUp(jsonRes, 70)

		if ramp < 0 || ramp > 1 {
			t.Fatalf("Ramp Up is out of range")
		}
	}

	defer resp.Body.Close()
}

// Testing Responsive Maintainer with secondary link
func TestResponsiveMaintainer2(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint2)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var resp = metrics.ResponsiveMaintainer(jsonRes)

		if resp < 0 || resp > 1 {
			t.Fatalf("Responsive Maintainer is out of range")
		}
	}

	defer resp.Body.Close()
}

// Testing Net Score with secondary link
func TestNetScore2(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint2)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var bus = metrics.BusFactor(jsonRes)
		var cor = metrics.Correctness(jsonRes)
		var ramp = metrics.RampUp(jsonRes, 130)
		var resp = metrics.ResponsiveMaintainer(jsonRes)
		var net = metrics.NetScore(cor, bus, ramp, resp, false)

		if net < 0 || net > 1 {
			t.Fatalf("Net Score is out of range")
		}
	}

	defer resp.Body.Close()
}

// Tests 13 - 18
// Testing busfactor with third link
func TestBusFactor3(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint3)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var bus = metrics.BusFactor(jsonRes)

		if bus < 0 || bus > 1 {
			t.Fatalf("Bus is out of range")
		}
	}

	defer resp.Body.Close()
}

// Testing correctness with third link
func TestCorrectness3(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint3)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var cor = metrics.Correctness(jsonRes)

		if cor < 0 || cor > 1 {
			t.Fatalf("Correctness is out of range")
		}
	}

	defer resp.Body.Close()
}

// Testing Ramp Up Time with third link
func TestRampUp3(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint3)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var ramp = metrics.RampUp(jsonRes, 600)

		if ramp < 0 || ramp > 1 {
			t.Fatalf("Ramp Up is out of range")
		}
	}

	defer resp.Body.Close()
}

// Testing Responsive Maintainer with third link
func TestResponsiveMaintainer3(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint3)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var resp = metrics.ResponsiveMaintainer(jsonRes)

		if resp < 0 || resp > 1 {
			t.Fatalf("Responsive Maintainer is out of range")
		}
	}

	defer resp.Body.Close()
}

// Testing NetScore with third link
func TestNetScore3(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint3)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var bus = metrics.BusFactor(jsonRes)
		var cor = metrics.Correctness(jsonRes)
		var ramp = metrics.RampUp(jsonRes, 74)
		var resp = metrics.ResponsiveMaintainer(jsonRes)
		var net = metrics.NetScore(cor, bus, ramp, resp, false)


		if net < 0 || net > 1 {
			t.Fatalf("Net Score is out of range")
		}
	}

	defer resp.Body.Close()
}

// Test 19

// Testing functionality when given a private link
func TestBusFactor_private(t *testing.T) {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GITHUB_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	resp, error := httpClient.Get(endpoint4)

	if error != nil {
		panic(error)
	}

	if resp.StatusCode == http.StatusOK {
		bodyBytes, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			panic(error)
		}
		bodyString := string(bodyBytes)

		// Citation needed for this
		resBytes := []byte(bodyString)
		var jsonRes map[string]interface{}
		_ = json.Unmarshal(resBytes, &jsonRes)

		var bus = metrics.BusFactor(jsonRes)

		if bus < 0 || bus > 1 {
			t.Fatalf("Bus is out of range")
		}
	}

	defer resp.Body.Close()
}