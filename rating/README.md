# ece461-project-cli

This custom command line interface application takes in a file of npmjs or github urls
to analyze, rank, and sort based on a variety of factors.

#### Ranking Factors
1) Correctness: How correct the module’s outputs are for Sarah’s needs 
2) Bus Factor: Measurement of risk for continued maintenance of the project
3) Responsive Maintainer: How responsive maintainers of the module are
4) Ramp-up Time: How easy it is for engineers to learn to use the module
5) License Compatibility: Compatibility with GNU Lesser General Public License v2.1 (LGPLv2.1)
6) Version Pinning: The percent of dependencies that are pinned to a major and minor version
7) Code Reviews: The amount of recent pull requests that were approved with a code review (last 100 to reflect modern repo trends)
8) Net Score: Weighted sum of first five factors

#### Run Commands
1) ./run install: Installs the dependencies and returns exit 0 on success or 1 on failure
2) ./run build: Completes any compilation and returns exit 0 on success or 1 on failure
3) ./run URL: Takes in a GitHub or npm URL and scores the repository for each of the metrics listed above
4) ./run test: runs a test suite, tests passed/tests total, coverage and returns exit 0 on success or 1 on failures

#### How To Run Application
Simply just type in any of the commands listed under "Run Commands" section

#### Citations
1) https://stackoverflow.com/questions/71153302/how-to-set-depth-for-recursive-iteration-of-directories-in-filepath-walk-func
2) https://rakaar.github.io/posts/2021-04-23-go-json-res-parse/
3) https://stackoverflow.com/questions/24809287/how-do-you-get-a-golang-program-to-print-the-line-number-of-the-error-it-just-ca
