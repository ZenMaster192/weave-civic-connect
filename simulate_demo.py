import requests
import json

BASE_URL = "http://localhost:8000/api"

def print_step(step_name):
    print(f"\n{'='*50}\n[STEP] {step_name}\n{'='*50}")

def login(email, password):
    res = requests.post(f"{BASE_URL}/auth/token", data={"username": email, "password": password})
    if res.status_code == 200:
        print(f"Logged in successfully as {email}")
        return res.json()["access_token"]
    else:
        print(f"Failed to login as {email}: {res.text}")
        return None

def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}

def main():
    print_step("1. User Logins")
    citizen_token = login("anjali@example.com", "password123")
    volunteer_token = login("ravi@example.com", "password123")
    ngo_token = login("sara@greenpune.org", "password123")

    if not all([citizen_token, volunteer_token, ngo_token]):
        print("Error: Could not log in to all accounts. Check if backend is running and seeded.")
        return

    print_step("2. Citizen creates a new issue")
    new_issue_data = {
        "title": "Water leakage in Main Street",
        "description": "Pipeline has burst causing water logging.",
        "category": "Plumbing",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "city": "Pune",
        "required_skills": "Plumbing,Repair"
    }
    res = requests.post(f"{BASE_URL}/issues", json=new_issue_data, headers=auth_headers(citizen_token))
    if res.status_code == 201:
        issue = res.json()
        issue_id = issue["id"]
        print(f"Issue created successfully: ID {issue_id} - {issue['title']}")
    else:
        print(f"Failed to create issue: {res.text}")
        return

    print_step("3. System dispatches issue to matching volunteers")
    # For demo purposes, we will hit the dispatch endpoint as if triggered by the system/NGO/citizen
    res = requests.post(f"{BASE_URL}/issues/{issue_id}/dispatch?limit=5", headers=auth_headers(citizen_token))
    if res.status_code == 200:
        print(f"Dispatch triggered: {res.json()['message']}")
    else:
        print(f"Failed to dispatch: {res.text}")

    print_step("4. Volunteer receives dispatch ping and accepts")
    res = requests.get(f"{BASE_URL}/volunteer/dispatch/pending", headers=auth_headers(volunteer_token))
    pending_dispatches = res.json()
    print(f"Pending dispatches for volunteer: {len(pending_dispatches)}")
    
    dispatch_id = None
    for d in pending_dispatches:
        if d["issue_id"] == issue_id:
            dispatch_id = d["id"]
            break
            
    if dispatch_id:
        res = requests.post(f"{BASE_URL}/volunteer/dispatch/{dispatch_id}/accept", headers=auth_headers(volunteer_token))
        if res.status_code == 200:
            print(f"Volunteer accepted the dispatch successfully!")
        else:
            print(f"Failed to accept dispatch: {res.text}")
    else:
        print("Error: The specific issue was not found in pending dispatches for the volunteer.")

    print_step("5. Volunteer resolves the issue")
    # Using the /resolve endpoint
    res = requests.patch(f"{BASE_URL}/issues/{issue_id}/resolve", headers=auth_headers(volunteer_token))
    if res.status_code == 200:
        print("Volunteer resolved the issue!")
    else:
        print(f"Failed to resolve: {res.text}")

    print_step("6. Citizen leaves a rating & review for the volunteer")
    review_data = {
        "rating": 5,
        "review_text": "Excellent and quick response!"
    }
    res = requests.post(f"{BASE_URL}/issues/{issue_id}/review", data=review_data, headers=auth_headers(citizen_token))
    if res.status_code == 200:
        print("Citizen submitted a review and rated the volunteer 5 stars.")
    else:
        print(f"Failed to submit review: {res.text}")

    print_step("7. NGO discovers independent volunteers")
    res = requests.get(f"{BASE_URL}/ngo/discover-volunteers?city=Pune", headers=auth_headers(ngo_token))
    if res.status_code == 200:
        vols = res.json()
        print(f"NGO discovered {len(vols)} volunteers in Pune.")
        for v in vols:
            print(f" - {v['volunteer_name']} (Impact: {v['impact_score']}, Resolved: {v['total_resolved']})")
    else:
        print(f"Failed to discover volunteers: {res.text}")

    print_step("8. NGO invites volunteer to join")
    # In the seed data, volunteer 1 (ravi) has ID 3 (citizen1=1, citizen2=2, volunteer1=3)
    volunteer_id_to_invite = 3
    res = requests.post(f"{BASE_URL}/ngo/membership/invite?volunteer_id={volunteer_id_to_invite}", headers=auth_headers(ngo_token))
    if res.status_code == 200:
        print("NGO successfully sent invite to volunteer.")
    else:
        print(f"Failed to send invite (might already exist): {res.text}")

    print_step("9. Volunteer checks pending NGO requests and accepts")
    res = requests.get(f"{BASE_URL}/ngo/membership/requests", headers=auth_headers(volunteer_token))
    if res.status_code == 200:
        reqs = res.json()
        print(f"Volunteer found {len(reqs)} pending membership requests.")
        if reqs:
            req_id = reqs[-1]["id"]
            res = requests.post(f"{BASE_URL}/ngo/membership/{req_id}/approve", headers=auth_headers(volunteer_token))
            if res.status_code == 200:
                print("Volunteer approved the NGO invite and is now part of the team.")
            else:
                print(f"Failed to approve invite: {res.text}")
    else:
        print(f"Failed to fetch requests: {res.text}")

if __name__ == '__main__':
    main()
