import requests
import os
import re
import sys

headers = {"Authorization":  "token " + os.getenv("GITHUB_TOKEN")}

def graphQLMetric(url):

    variables = {
        "url": url
      }
        
    query = """
    query MyQuery($url: URI!) {
    resource(url: $url) {
        ... on Repository {
            pullRequests(last:100, states: [CLOSED, MERGED]) {
            nodes {
            number
            url
            state
            reviews(last:10) {
                nodes{
                author {
                    login
                }
                state
                }
            }
            }
        } 
        }
    }
    }
    """

    result = performQuery(query, variables)
    
    file1 = open('QueryOutput.txt', 'w')
    result = str(result)
    file1.write(result)
    
    #want to get # of instances of 'number:"' and this is the number of pull requests that we got (will be 100 unless repo is small)
    #want to get # of instances of 'nodes":[]' and this is the number of pull requests without any reviews
    numEmpty = 0
    numReqs = 0
    for match in re.findall(r'nodes\":\[\]', result):
        numEmpty = numEmpty+1
    for match in re.findall(r'number\":', result):
        numReqs = numReqs+1    

    file1.close()
    os.remove('QueryOutput.txt')
    
    if numReqs == 0:
        score = 1
    elif result == 0:
        score = 0
    else:
        score = (numReqs - numEmpty) / numReqs

    
    file1 = open('CR_Score.txt', 'w')
    result = str(score)
    file1.write(result)
    file1.close()
    return

def performQuery(query, variables):
    request = requests.post('https://api.github.com/graphql', json={'query': query, 'variables': variables}, headers=headers)
    # print(request.reason)
    if request.status_code == 200: # checks if request was successful
        # return request.json() # returns results
        return request.content # for some reason regexes like this better
        
    else: # in case of expection
      return 0 # error case
    


graphQLMetric(sys.argv[1])