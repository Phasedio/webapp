'use strict';

/**

	set up firebase

	if firebase DB isn't set up, make sure default data is in

**/

// Firebase business
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");

var FBRef = new Firebase("https://phased-dev2.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator("A50wFi5OxaLYNzb4jnEyFMQWmE8mjRyWJCKW723g");
var token = tokenGenerator.createToken({uid: "modServer" , origin : "auth.controller.js" });
FBRef.authWithCustomToken(token, function(error, authData) {});

exports.index = function(req, res) {
	FBRef.child('meta').once('value', function(snap) {
		if (!snap.val()) {
			setUpFirebase();
			console.log('database newly set up');
		} else {
			console.log('database already set up');
		}
		res.json([]);
	});
};

// sets up the entire database to DBStartModel.
var setUpFirebase = function() {
	var DBStartModel = {
		meta : {
			task : {
				/*
					As an example, Phased.meta.task.PRIORITY and Phased.meta.task.PRIORITY_ID
					can work together. On app load, these values will be exposed on the 
					Phased provider in Phased.TASK_PRIORITY and Phased.TASK_PRIORITY_ID.
					Then, set a task's priority to one of the const ID values
						myTask.priority = Phased.TASK_PRIORITY_ID.HIGH;
					and reference the text of that ID in the view
						<p>Priority: {{Phased.TASK_PRIORITY[myTask.priority]}}</p>
				*/
				PRIORITY : {
					0 : "high",
					1 : "medium",
					2 : "low"
				},
				PRIORITY_ID : {
					HIGH : 0,
					MEDIUM : 1,
					LOW : 2
				},
				STATUS : {
					0 : "In progress",
					1 : "Complete",
					2 : "Assigned"
				},
				STATUS_ID : {
					IN_PROGRESS : 0,
	        COMPLETE : 1,
	        ASSIGNED : 2
				},
				HISTORY : {
					CREATED : 0,
	        ARCHIVED : 1,
	        UNARCHIVED : 2,
	        NAME : 3,
	        DESCRIPTION : 4,
	        ASSIGNEE : 5,
	        DEADLINE : 6,
	        CATEGORY : 7,
	        PRIORITY : 8,
	        STATUS : 9
				}
			},
			project : {
				PRIORITY : {
					0 : "high",
					1 : "medium",
					2 : "low"
				},
				PRIORITY_ID : {
					HIGH : 0,
					MEDIUM : 1,
					LOW : 2
				},
				HISTORY : {
					0 : "created",
					1 : "name changed",
					2 : "description changed",
					3 : "deadline changed",
					4 : "archived",
					5 : "unarchived",
				},
				HISTORY_ID : {
					CREATED : 0,
					NAME : 1,
					DESCRIPTION : 2,
					DEADLINE : 3,
					ARCHIVED : 4,
					UNARCHIVED : 5
				}
			},
			column : {
				HISTORY : {
					0 : "created",
					1 : "name changed",
					2 : "description changed"
				},
				HISTORY_ID : {
					CREATED : 0,
					NAME : 1,
					DESCRIPTION : 2
				}
			},
			card : {
				PRIORITY : {
					0 : "high",
					1 : "medium",
					2 : "low"
				},
				PRIORITY_ID : {
					HIGH : 0,
					MEDIUM : 1,
					LOW : 2
				},
				HISTORY : {
					0 : "created",
					1 : "name changed",
					2 : "description changed",
					3 : "column changed"
				},
				HISTORY_ID : {
					CREATED : 0,
					NAME : 1,
					DESCRIPTION : 2,
					COLUMN : 3
				}
			},
			ROLE : {
				0 : "member",
				1 : "admin",
				2 : "owner"
			},
			ROLE_ID : {
				MEMBER : 0,
				ADMIN : 1,
				OWNER : 2
			},
			PRESENCE : {
				0 : "offline",
				1 : "online",
				2 : "away",
				3 : "busy"
			},
			PRESENCE_ID : {
				OFFLINE : 0,
				ONLINE : 1,
				AWAY : 2,
				BUSY : 3
			},
	    NOTIF_TYPE : { 
				0 : "History",
				1 : "Assignment created",
				2 : "Assignment archived",
				3 : "Assignment unarchived",
				4 : "Assignment updated",
				5 : "Assignment assigned",
				6 : "Assignment to me",
				7 : "Assignment status changed",
				8 : "User created"
	    },
			NOTIF_TYPE_ID : {
	      HISTORY : 0,
	      ASSIGNMENT_CREATED : 1,
	      ASSIGNMENT_ARCHIVED : 2,
	      ASSIGNMENT_UNARCHIVED : 3,
	      ASSIGNMENT_UPDATED : 4,
	      ASSIGNMENT_ASSIGNED : 5,
	      ASSIGNMENT_ASSIGNED_TO_ME : 6,
	      ASSIGNMENT_STATUS : 7,
	      USER_CREATED : 8
	    }
		},
		profile : {
			'62cf208c-e17e-4301-850f-65c0e05a9ae9' : {
				name : 'Dave Riedstra',
				email : 'dave.riedstra@gmail.com',
				curTeam : 'Phased',
				gravatar : 'https://www.gravatar.com/avatar/317dbda57b67eef8101bd92a1ada521c.jpg?d=identicon',
				teams : {
					'0' : 'Phased'
				}
			}
		},
		team : {
			Phased : {
				name : "Phased",
				statuses : {
					'0' : {
						cat : '',
						name : 'Hello world',
						time : Firebase.ServerValue.TIMESTAMP,
						user : '62cf208c-e17e-4301-850f-65c0e05a9ae9'
					}
				},
				members : {
					'62cf208c-e17e-4301-850f-65c0e05a9ae9' : {
						currentStatus : {
							key : '0',
							name : 'Hello world',
							time : Firebase.ServerValue.TIMESTAMP,
							user : '62cf208c-e17e-4301-850f-65c0e05a9ae9'
						},
						role : 1 // admin
					}
				},
				billing : {
					name : 'Brian Best',
					stripeid : "cus_7BnYeTzKewcq7d",
					plan : 'basic'
				},
				category : {
					'0' : {
						color : "#ffcc00",
						name : 'Communication'
					},
					'1' : {
						color : "#5ac8fb",
						name : "Planning"
					}
				}
			}
		},
		notif : {
			Phased : {
				'62cf208c-e17e-4301-850f-65c0e05a9ae9' : {
					'0' : {
						title : "User created",
						body : "Welcome to the world",
						time : Firebase.ServerValue.TIMESTAMP,
						type : 8
					}
				}
			}
		}
	};

	FBRef.set(DBStartModel);
}