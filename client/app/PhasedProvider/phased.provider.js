angular.module('webappApp')
  .provider('Phased', function() {

    /**

      PhasedProvider provides a single access point for interacting with the Phased FireBase server.

      It provides
        - methods for adding, updating, or removing data from the server
        - 'live' properties reflecting the data in the database (courtesy of FBRef.on())
        - 'static' properties reflecting Phased constants (such as task priority names and IDs)

      Note on FireBase async:
        Methods can be called from controllers that request data from Auth before the
      FireBase AJAX requests (called in AuthProvider.doAfterAuth()) that gather that data are complete. To
      circumvent this, methods that need this data are registered as callbacks (via registerAsync) which
      are either fired immediately if doAfterAuth is complete (ie, PHASED_SET_UP == true) or at the end of
      this.init() if not (via doAsync).
        Because of this, all methods exposed by PhasedProvider must be registered with an async callback
        (callbacks are listed below)

      Class organization:

      - Class setup
        - Internal variables (defaults, flags, callback lists)
        - Provider prototype definition
        - general init -- this.init()
        - constructor -- this.$get
      - Config functions (which set flags)
      - Async interfaces (which ensure exposed functions aren't called before data they depend on)
      - Init functions (which gather team and member data and apply Firebase watchers, called in this.init())
      - Watching functions (which observe firebase data and apply to the appropriate properties on the provider)
      - Internal utilities (used by exposed functions to perform routine operations)
        - issueNotification
        - updateHistory
        - cleaning objects to go to the DB
        - other JS utils
      - Exposed functions (which all use the async interfaces and are all applied to the Provider prototype)
        - General account things
        - "Data functions" (adding statuses or tasks, modifying projects, etc)

			Events:

			- Phased:setup -- all meta, user, team, team member, status, and project/task data has been loaded
			- Phased:meta -- all metadata has been loaded
			- Phased:member -- a single member has been loaded
			- Phased:memberChanged -- a single member has changed
			- Phased:teamComplete -- all team metadata is loaded
			- Phased:membersComplete -- all team members have been loaded
			- Phased:projectsComplete -- all projects are fully loaded (including col/card/task data)
			- Phased:statusesComplete -- all statuses are loaded
			- Phased:newStatus -- a new status is added
			- Phased:changedStatus -- a status has changed
			- Phased:deletedStatus -- a status has been deleted

			- Phased:PaymentInfo -- team payment info (and Phased.viewType) has changed
			- Phased:notification -- the current user has received a notification
			- Phased:switchedTeam -- the current user has switched to a new team

				 For the following, Phased:[thing]Added is called on FireBase child_added.
				 This means that on setup, these events are broadcast
				 for EVERY 'thing' in the team's database!
				 To get only NEW 'things', register event handlers in a callback
				 to, eg, Phased:setup or Phased:projectsComplete

			- Phased:columnAdded
			- Phased:columnDeleted
			- Phased:cardAdded
			- Phased:cardDeleted
			- Phased:taskAdded
			- Phased:taskDeleted
			- Phased:projectAdded
			- Phased:projectDeleted

			Callbacks:

			registerAsync					PHASED_SET_UP
			registerAfterMeta			PHASED_META_SET_UP
			registerAfterMembers	PHASED_MEMBERS_SET_UP
			registerAfterProjects	PHASED_PROJECTS_SET_UP
			registerAfterStatuses	PHASED_STATUSES_SET_UP

    **/

    /**
    * Internal vars
    */
    var DEFAULTS = {
      // these all need to be strings
      projectID : '0A',
      columnID : '0A',
      cardID : '0A'
    },

      // FLAGS
      PHASED_SET_UP = false, // set to true after team is set up and other fb calls can be made
      PHASED_TEAM_SET_UP = false,
      PHASED_MEMBERS_SET_UP = false, // set to true after member data has all been loaded
      PHASED_META_SET_UP = false, // set to true after static meta values are loaded
      PHASED_PROJECTS_SET_UP = false, // set to true after the initial data has been loaded (incl col/card/task)
      PHASED_STATUSES_SET_UP = false,
      WATCH_PROJECTS = false, // set in setWatchProjects in config; tells init whether to do it
      WATCH_NOTIFICATIONS = false, // set in setWatchNotifications in config; whether to watch notifications
      WATCH_PRESENCE = false, // set in setWatchPresence in config; whether to update user's presence
      WATCH_INTEGRATIONS = false, // set in setWatchIntegrations in config; whether to monitor integration data
      WEBHOOKS_LIVE = { // switches for individual webhooks, so that eg Github hooks can be live while Google is in dev
      	GITHUB : true,
      	GOOGLE : true
      },

      // ASYNC CALLBACKS
      req_callbacks = [], // filled with operations to complete when PHASED_SET_UP
      req_after_team = [],
      req_after_members = [], // filled with operations to complete after members are in
      req_after_meta = [], // filled with operations to complete after meta are in
      req_after_projects = [], // "" for after projects
      req_after_statuses = [], // "" for after statuses
      oldestStatusTime = new Date().getTime(), // date of the oldest status in memory; used for pagination

      // INTERNAL "CONSTANTS"
      BOUNCE_ROUTES = {}, // routes for different view types to bounce to
      WEBHOOK_HOSTNAME = { // host names for our own webhook endpoints (with trailing slash)
      	LIVE : 'https://app.phased.io/',
      	DEV : 'http://93aa8d5a.ngrok.io/'
      },
      STATUS_LIMIT = 30, // limit to how many statuses to load
      NOTIF_LIMIT = 30; // limit to how many notifications to keep in memory





    var _Auth, FBRef; // tacked on to PhasedProvider
    var ga = ga || function(){}; // in case ga isn't defined (as in chromeapp)
    var $rootScope = { $broadcast : function(a){} }; // set in $get, default for if PhasedProvider isn't injected into any scope. not available in .config();
    var $http = {}; // ditto
    var $location = {}; // me too

    /**
    *
    * The provider itself (all hail)
    * returned by this.$get
    */
    var PhasedProvider = {
        _membersRetrieved : 0, // incremented with each member's profile gathered
        SET_UP : false, // exposed duplicate of PHASED_SET_UP
        META_SET_UP : false,
        MEMBERS_SET_UP : false,
        PROJECTS_SET_UP : false,
        STATUSES_SET_UP : false,
        FBRef : FBRef, // set in setFBRef()
        user : {}, // set in this.init() to Auth.user.profile
        team : { // set in initializeTeam()
          _FBHandlers : [], // filled with callbacks to deregister in unwatchTeam()
          members : {},
          statuses : [], // stream of team's status updates
          teamLength : 0 // members counted in setUpTeamMembers
        },
        get : { // a read-only unordered list of objects which otherwise would have been nested.
          columns : {},
          cards : {},
          tasks : {}
        },
        viewType : 'notPaid',

        // META CONSTANTS
        // set up in intializeMeta()
        // TASK
        task : {
          PRIORITY : {},
          PRIORITY_ID : {},

          HISTORY_ID : {},

          STATUS : {},
          STATUS_ID : {}
        },

        // PROJECT
        project : {
          PRIORITY : {},
          PRIORITY_ID : {},

          HISTORY : {},
          HISTORY_ID : {}
        },

        // COLUMN
        column : {
          HISTORY : {},
          HISTORY_ID : {}
        },

        // CARD
        card : {
          PRIORITY : {},
          PRIORITY_ID : {},

          HISTORY : {},
          HISTORY_ID : {}
        },

        // STATUS
        status : {
        	SOURCE : {},
        	SOURCE_ID : {},
        	TYPE : {},
        	TYPE_ID : {}
        },

        // ROLE
        ROLE : {},
        ROLE_ID : {},

        // PRESENCE
        PRESENCE : {},
        PRESENCE_ID : {},

        // NOTIF
        NOTIF_TYPE : {},
        NOTIF_TYPE_ID : {},


        // data streams
        // data updated with FBRef.on() watches
        //
        notif : {}, // notifications for current user
        assignments : { // Phased.assignments
          all : {}, // all of the team's assignments
          to_me : {}, // assigned to me (reference to objects in all)
          by_me : {}, // assigned by me (reference to objects in all)
          unassigned : {} // unassigned (reference to objects in all)
        },
        archive : {
          all : {},
          to_me : {},
          by_me : {},
          unassigned : {}
        }
      };

    /**
    *
    * configure the provider and begin requests
    * called in AuthProvider's doAfterAuth callback,
    * which must be set in a .config() block
    *
    * optionally passed a config object, which describes
    * whether team history or assignments should be monitored
    */

    this.init = function(Auth) {
      _Auth = Auth;
      PhasedProvider.user = Auth.user.profile;
      PhasedProvider.user.uid = Auth.user.uid;
      PhasedProvider.team.uid = Auth.currentTeam;

      initializeMeta(); // gathers static values set in DB

      // only do these if user is on a team for which they can see members,
      // notifications, have presence logged!
      if (Auth.currentTeam) {
        initializeTeam(); // gathers/watches team and members

        if (WATCH_NOTIFICATIONS)
          watchNotifications();
        if (WATCH_PRESENCE)
          registerAfterMeta(watchPresence);
        if (WATCH_INTEGRATIONS) {
        	watchGoogleCalendars();
        }

        // if the user is new, welcome them to the world
        // and remove newUser flag
        // doesn't need to be done after team data is in, since the server
        // will do that heavy lifting
        if (Auth.user.profile.newUser) {
          FBRef.child('profile/' + PhasedProvider.user.uid + '/newUser').remove();
          registerAfterMembers(function() {
            issueNotification({
              title : [{string : 'Welcome to Phased, '}, {userID: Auth.user.uid}],
              body : [],
              type : PhasedProvider.NOTIF_TYPE_ID.USER_CREATED
            });
          });
        }
      }
    }

    /**
    *
    * constructs the provider itself
    * exposes data, methods, and a FireBase reference
    *
    */
    this.$get = ['$rootScope', '$http', '$location', function(_rootScope, _http, _location) {
      $rootScope = _rootScope;
      $http = _http;
      $location = _location;
      // register functions listed after this in the script...

      // ensure user and team have right privileges
      PhasedProvider.maybeBounceUser = _maybeBounceUser;

      // add member and team
      PhasedProvider.addMember = _addMember;
      PhasedProvider.changeMemberRole = _changeMemberRole;
      PhasedProvider.addTeam = _addTeam;
      PhasedProvider.switchTeam = _switchTeam;

      // STATUS update (formerly HISTORY or TASKS)
      PhasedProvider.addStatus = _addStatus;

      // CATEGORY manipulation (per-team)
      PhasedProvider.addCategory = _addCategory;
      PhasedProvider.deleteCategory = _deleteCategory;

      // TASKS (formerly ASSIGNMENTS and also TASKS... kind of...)
      // creating and manipulating
      PhasedProvider.addTask = _addTask;
      PhasedProvider.setTaskStatus = _setTaskStatus;
      PhasedProvider.setTaskName = _setTaskName;
      PhasedProvider.setTaskDesc = _setTaskDesc;
      PhasedProvider.setTaskDeadline = _setTaskDeadline;
      PhasedProvider.setTaskAssignee = _setTaskAssignee;
      PhasedProvider.setTaskCategory = _setTaskCategory;
      PhasedProvider.setTaskPriority = _setTaskPriority;
      // activating / shuffling
      PhasedProvider.activateTask = _activateTask;
      PhasedProvider.completeTask = _completeTask;
      PhasedProvider.takeTask = _takeTask;

      // NOTIFS
      PhasedProvider.markNotifAsRead = _markNotifAsRead;
      PhasedProvider.markAllNotifsAsRead = _markAllNotifsAsRead;

      // PAGINATED STATUSES FOR USER
      PhasedProvider.getStatusesPage = _getStatusesPage;

      // INTEGRATIONS
      // GITHUB
      PhasedProvider.updateGHAlias = _updateGHAlias;
      PhasedProvider.getGHRepos = _getGHRepos;
      PhasedProvider.getGHRepoHooks = _getGHRepoHooks;
      PhasedProvider.getAllGHRepoHooks = _getAllGHRepoHooks;
      PhasedProvider.registerGHWebhookForRepo = _registerGHWebhookForRepo;
      PhasedProvider.toggleGHWebhookActive = _toggleGHWebhookActive;
      PhasedProvider.deleteGHWebhook = _deleteGHWebhook;
      // GOOGLE
      PhasedProvider.checkGoogleAuth = _checkGoogleAuth;
      PhasedProvider.getGoogleCalendars = _getGoogleCalendars;
      PhasedProvider.registerGoogleCalendar = _registerGoogleCalendar;
      PhasedProvider.deregisterGoogleCalendar = _deregisterGoogleCalendar;

      return PhasedProvider;
    }];

    // must be called in config or everything breaks
    this.setFBRef = function(FURL) {
      FBRef = new Firebase(FURL);
      PhasedProvider.FBRef = FBRef;
    }

    /*
    **
    **  FLAGS
    **  must all be set in .config before this.init()
    **
    */

    // sets WATCH_PROJECTS
    // determines whether projects are monitored
    this.setWatchProjects = function(watch) {
      if (watch)
        WATCH_PROJECTS = true;
    }

    // sets WATCH_NOTIFICATIONS
    // determines whether notifications are monitored
    this.setWatchNotifications = function(watch) {
      if (watch)
        WATCH_NOTIFICATIONS = true;
    }

    // sets WATCH_PRESENCE
    // determines whether own user's presence is monitored
    this.setWatchPresence = function(watch) {
      if (watch)
        WATCH_PRESENCE = true;
    }

    // sets WATCH_INTEGRATIONS
    // determines whether own user's registered
    // integrations metadata are watched (currently only
    // Google Calendar)
    this.setWatchIntegrations = function(watch) {
      if (watch)
        WATCH_INTEGRATIONS = true;
    }

    // sets BOUNCE_ROUTES for different viewTypes
    // pass FALSE not to bounce for team pay statuses
    // otherwise, pass an object so that
    // BOUNCE_ROUTES[viewType] == '/routeForThatView'
    // eg,
    // BOUNCE_ROUTES['problem'] == '/team-expired'
    this.setBounceRoutes = function(newRoutes) {
  		BOUNCE_ROUTES = newRoutes;
    }


    /*
    **
    **  ASYNC FUNCTIONS
    **  An interface for functions that depend on remote data
    **  Exposed functions call register____, passing it a reference
    **  to the internal function that is needed. If the condition
    **  determined by the flag is met, the callback is executed
    **  immediately; if not, it is added to the list of callbacks
    **  which are fired as soon as the condition is met.
    **
    **  in general,
    **
    **  PhasedProvider.exposedMethod = _exposedMethod;
    **
    **  // after condition is met
    **  PHASED_CONDITION = true;
    **  doCondition();
    **
    **  var _exposedMethod = function(args) {
    **    registerCondition(doExposedMethod, args);
    **  }
    **  var doExposedMethod = function(args){
    **    // some stuff;
    **  }
    **
    */

    /**
    *
    * registerAsync
    * if Phased has team, member, status, and task data, do the thing
    * otherwise, add it to the list of things to do
    *
    */
    var registerAsync = function(callback, args) {
      if (PHASED_SET_UP)
        return callback(args);
      else
        req_callbacks.push({callback : callback, args : args });
    }

    var doAsync = function() {
      for (var i in req_callbacks) {
        req_callbacks[i].callback(req_callbacks[i].args || undefined);
      }
      PHASED_SET_UP = true;
      PhasedProvider.SET_UP = true;
      console.log('Phased:setup', PhasedProvider);
			$rootScope.$broadcast('Phased:setup');
    }

    /**
    *
    *	maybeFinalizeSetUp
    *	checks if the Provider is totally set up, then calls doAsync
    *
    */
    var maybeFinalizeSetUp = function() {
    	$rootScope.$evalAsync(function(){
	    	if (  !PHASED_SET_UP
		    		&& PHASED_META_SET_UP
		    		&& PHASED_MEMBERS_SET_UP
		    		&& PHASED_PROJECTS_SET_UP
		    		&& PHASED_STATUSES_SET_UP
	    		) {
	    		doAsync();
	    	}
	    });
    }

    /**
    *
    * registerAfterMeta
    * called after meta is in from server
    *
    */
    var registerAfterMeta = function(callback, args) {
      if (PHASED_META_SET_UP)
        callback(args);
      else
        req_after_meta.push({callback : callback, args : args });
    }

    var doAfterMeta = function() {
      for (var i in req_after_meta) {
        req_after_meta[i].callback(req_after_meta[i].args || undefined);
      }
      PHASED_META_SET_UP = true;
      PhasedProvider.META_SET_UP = true;
			$rootScope.$broadcast('Phased:meta');
      maybeFinalizeSetUp();
    }

    /**
    *
    * registerAfterTeam
    * called after team data is in from server
    *	(team metadata but not members' individual data)
    *
    */
    var registerAfterTeam = function(callback, args) {
      if (PHASED_TEAM_SET_UP)
        callback(args);
      else
        req_after_team.push({callback : callback, args : args });
    }

    var doAfterTeam = function() {
      for (var i in req_after_team) {
        req_after_team[i].callback(req_after_team[i].args || undefined);
      }
      PHASED_TEAM_SET_UP = true;
      PhasedProvider.TEAM_SET_UP = true;
      $rootScope.$broadcast('Phased:teamComplete');
      maybeFinalizeSetUp(); // this should definitely fail but will cue a digest if needed
    }

    /**
    *
    * registerAfterMembers
    * called after member data is in from server
    */
    var registerAfterMembers = function(callback, args) {
      if (PHASED_MEMBERS_SET_UP)
        callback(args);
      else
        req_after_members.push({callback : callback, args : args });
    }

    var doAfterMembers = function() {
      for (var i in req_after_members) {
        req_after_members[i].callback(req_after_members[i].args || undefined);
      }
      PHASED_MEMBERS_SET_UP = true;
      PhasedProvider.MEMBERS_SET_UP = true;
      $rootScope.$broadcast('Phased:membersComplete');
      maybeFinalizeSetUp();
    }

    /**
    *
    * registerAfterProjects
    * called after all project data is in from server
    * implied that col/card/task data is also ALL in
    */
    var registerAfterProjects = function(callback, args) {
      if (PHASED_PROJECTS_SET_UP)
        callback(args);
      else
        req_after_projects.push({callback : callback, args : args });
    }

    var doAfterProjects = function() {
      for (var i in req_after_projects) {
        req_after_projects[i].callback(req_after_projects[i].args || undefined);
      }

			PHASED_PROJECTS_SET_UP = true;
      PhasedProvider.PROJECTS_SET_UP = true;
			$rootScope.$broadcast('Phased:projectsComplete');
			maybeFinalizeSetUp();
    }

    /**
    *
    * registerAfterStatuses
    * called after all status (timeline) data is in from server
    */
    var registerAfterStatuses = function(callback, args) {
      if (PHASED_STATUSES_SET_UP)
        callback(args);
      else
        req_after_statuses.push({callback : callback, args : args });
    }

    var doAfterStatuses = function() {
      for (var i in req_after_statuses) {
        req_after_statuses[i].callback(req_after_statuses[i].args || undefined);
      }

			PHASED_STATUSES_SET_UP = true;
      PhasedProvider.STATUSES_SET_UP = true;
			$rootScope.$broadcast('Phased:statusesComplete');
			maybeFinalizeSetUp();
    }




    /*
    **
    **  INTIALIZING FUNCTIONS
    **
    */

    /*
    *
    * Gathers all static data, applies to PhasedProvider
    *
    */
    var initializeMeta = function() {
      FBRef.child('meta').once('value', function(snap) {
        var data = snap.val();

        // task
        PhasedProvider.task = {
          PRIORITY : data.task.PRIORITY,
          PRIORITY_ID : data.task.PRIORITY_ID,

          HISTORY_ID : data.task.HISTORY_ID, // no strings for this one

          STATUS : data.task.STATUS,
          STATUS_ID : data.task.STATUS_ID
        };

        // PROJECT
        PhasedProvider.project = {
          PRIORITY : data.project.PRIORITY,
          PRIORITY_ID : data.project.PRIORITY_ID,

          HISTORY : data.project.HISTORY,
          HISTORY_ID : data.project.HISTORY_ID
        };

        // COLUMN
        PhasedProvider.column = {
          HISTORY : data.column.HISTORY,
          HISTORY_ID : data.column.HISTORY_ID
        };

        // CARD
        PhasedProvider.card = {
          PRIORITY : data.card.PRIORITY,
          PRIORITY_ID : data.card.PRIORITY_ID,

          HISTORY : data.card.HISTORY,
          HISTORY_ID : data.card.HISTORY_ID
        };

        // STATUS
        PhasedProvider.status.SOURCE = data.status.SOURCE;
        PhasedProvider.status.SOURCE_ID = data.status.SOURCE_ID;
        PhasedProvider.status.TYPE = data.status.TYPE;
        PhasedProvider.status.TYPE_ID = data.status.TYPE_ID;

        // ROLE
        PhasedProvider.ROLE = data.ROLE;
        PhasedProvider.ROLE_ID = data.ROLE_ID;

        // PRESENCE
        PhasedProvider.PRESENCE = data.PRESENCE;
        PhasedProvider.PRESENCE_ID = data.PRESENCE_ID;

        // NOTIF
        PhasedProvider.NOTIF_TYPE = data.NOTIF_TYPE;
        PhasedProvider.NOTIF_TYPE_ID = data.NOTIF_TYPE_ID;

        doAfterMeta();
      });
    }

    /*
    *
    * Gathers all of the team data for the first time and sets appropriate
    * watching functions.
    *
    * Requires PhasedProvider.team.uid and PhasedProvider.user
    *
    */
    var initializeTeam = function() {
    	var teamID = PhasedProvider.team.uid,
    		teamAddr = 'team/' + teamID,
    		simpleProps = ['name', 'members', 'category', 'repos', 'slack', 'billing'],
    		loaded = [];
      PhasedProvider._membersRetrieved = 0;
      PHASED_STATUSES_SET_UP = PhasedProvider.STATUSES_SET_UP = false;
      PHASED_PROJECTS_SET_UP = PhasedProvider.PROJECTS_SET_UP = false;
      PHASED_MEMBERS_SET_UP = PhasedProvider.MEMBERS_SET_UP = false;

    	// due to the current data structure, it's easier to make many small calls
    	// than one big call (thanks to statuses being at the same root as name, repos, etc)
    	for (var i in simpleProps) {
    		(function getSimpleProp(prop) {
    			FBRef.child(teamAddr + '/' + prop).once('value', function(snap){
    				var data = snap.val();
    				PhasedProvider.team[prop] = data;

    				if (prop == 'members') {
    					PhasedProvider.team.teamLength = Object.keys(data).length;
    					// get profile details for team members
			        for (var id in PhasedProvider.team.members) {
			          initializeMember(id);
			        }
						} else if (prop == 'category') {
							delete PhasedProvider.team.category; // not actually using that key
							PhasedProvider.team.categoryObj = data;
							PhasedProvider.team.categorySelect = objToArray(data); // adds key prop
    				}

    				// check/broadcast team set up
    				loaded.push(prop);
    				if (loaded.length == simpleProps.length) {
    					// we're all loaded
    					doAfterTeam();
    				}
    			});
    		})(simpleProps[i]);
    	}

    	// get projects
    	FBRef.child(teamAddr + '/projects').once('value', function getTeamProjects(snap) {
    		var data = snap.val();
    		PhasedProvider.team.projects = data || {};
    		if (!data) {
    			if (!WATCH_PROJECTS) doAfterProjects();
    			return;
    		}

    		PhasedProvider.team.projects['0A'].columns['0A'].cards['0A'].tasks = PhasedProvider.team.projects['0A'].columns['0A'].cards['0A'].tasks || {};

    		// set up references in .get[objectName] to their respective objects
        // this allows us to have an unordered collection of, eg, all tasks, to gather data
        // (this is similar to how .assignments.all used to work)
        for (var i in PhasedProvider.team.projects) {
          for (var j in PhasedProvider.team.projects[i].columns)
            PhasedProvider.get.columns[j] = PhasedProvider.team.projects[i].columns[j];
        }
        for (var i in PhasedProvider.get.columns) {
          for (var j in PhasedProvider.get.columns[i].cards)
            PhasedProvider.get.cards[j] = PhasedProvider.get.columns[i].cards[j];
        }
        for (var i in PhasedProvider.get.cards) {
          for (var j in PhasedProvider.get.cards[i].tasks)
            PhasedProvider.get.tasks[j] = PhasedProvider.get.cards[i].tasks[j];
        }

        // if we're only gathering the project data once, or if there are no tasks
        // finish this part of setup
        if (!WATCH_PROJECTS || Object.keys(PhasedProvider.get.tasks).length < 1) {
        	doAfterProjects();
        }

        // maybe watch projects
        // (can't be else of above statement because we might not watch if team has 0 tasks)
        // has to be called here to be after tasks are loaded
        if (WATCH_PROJECTS)
          watchProjects();
    	});

			// get statuses
      FBRef.child(teamAddr + '/statuses')
      .limitToLast(STATUS_LIMIT)
      .once('value', function getTeamStatuses(snap) {
        var data = snap.val();

        PhasedProvider.team.statuses = data || []; // need to do this here bc FB doesn't store empty vals
        // find oldest status time and save val for pagination
        for (var i in PhasedProvider.team.statuses) {
    			if (PhasedProvider.team.statuses[i].time < oldestStatusTime)
    				oldestStatusTime = PhasedProvider.team.statuses[i].time;
    		}
        // statuses are all in
        doAfterStatuses();
        // monitor team for changes
        watchTeam();
      });
    }

    /**
    *
    * Gathers then watches a member's profile data
    *
    * 1. make one call to get initial data
    * 2. apply data to appropriate properties
    * 3. set child_changed listener on /profile/$uid
    * 3B. which applies the incoming data to the appropriate key
    *
    * Logistical things:
    * L1. stash handler so we can un-watch when needed
    * L2. broadcast Phased:member for each member
    * L3. broadcast Phased:membersComplete when all are in
    * L4. call doAfterMembers() when all are in.
    *
    */
    var initializeMember = function(id) {
      // 1. gather all data once
      FBRef.child('profile/' + id).once('value', function(snap){
        var data = snap.val();
        if (!data) return; // don't initiate ghost members

        PhasedProvider.team.members[id] = PhasedProvider.team.members[id] || {};

        // 2. apply data
        PhasedProvider.team.members[id].name = data.name;
        PhasedProvider.team.members[id].pic = data.gravatar;
        PhasedProvider.team.members[id].gravatar = data.gravatar;
        PhasedProvider.team.members[id].email = data.email;
        PhasedProvider.team.members[id].tel = data.tel;
        PhasedProvider.team.members[id].uid = id;
        PhasedProvider.team.members[id].newUser = data.newUser;

        if (id == PhasedProvider.user.uid)
          getUsersTeams(data.teams);

        // 3. and then watch for changes
        var handler = FBRef.child('profile/' + id).on('child_changed', function(snap) {
          var data = snap.val(),
            key = snap.key(),
            currentUser = id == PhasedProvider.user.uid;

          // 3B. apply data to appropriate key
          PhasedProvider.team.members[id][key] = data;
          if (currentUser) { // if this is for the current user
            if (key == 'teams') { // need to get team names and keep IDs
              getUsersTeams(data);
            } else { // simply assign
              PhasedProvider.user[key] = data
            }
          }

          // special duplicate case
          if (key == 'gravatar') {
            PhasedProvider.team.members[id].pic = data;
            if (currentUser)
              PhasedProvider.user.pic = data;
          }

          // notify
          $rootScope.$broadcast('Phased:memberChanged');
        });

        // L1. stash handler to stop watching event if needed
        var deregister_obj = {
            address : 'profile/' + id,
            eventType : 'child_changed',
            callback : handler
          };

        ('_FBHandlers' in PhasedProvider.team.members[id] &&
          typeof PhasedProvider.team.members[id]._FBHandlers == 'object') ?
          PhasedProvider.team.members[id]._FBHandlers.push(deregister_obj) :
          PhasedProvider.team.members[id]._FBHandlers = [deregister_obj];

        // L2. broadcast events to tell the rest of the app the team is set up
        $rootScope.$broadcast('Phased:member');

        // L3. and L4. (once all members are in)
        PhasedProvider._membersRetrieved++;
        if (PhasedProvider._membersRetrieved == PhasedProvider.team.teamLength && !PHASED_MEMBERS_SET_UP) {
          doAfterMembers();
        }
      });

      // get user's team names. have to go to DB bc team names are only stored at /team/$teamID/name
      var getUsersTeams = function(teamList) {
        for (var i in teamList) {
          (function(teamIndex){
          var teamID = teamList[teamIndex];
          FBRef.child('team/' + teamID + '/name').once('value', function(snap){
            if (typeof PhasedProvider.user.teams != 'object')
              PhasedProvider.user.teams = {};

            PhasedProvider.user.teams[teamIndex] = {
              id : teamID,
              name : snap.val()
            }
          });
        })(i)
        }
      }
    }

    /**
    *
    * Checks current plan status
    *
    * Checks ./api/pays/find for the current team's viewType
    * defaults to 'notPaid'
    *
    **/
    var checkPlanStatus = function(stripeid,subid) {
      if (typeof stripeid == 'string' && stripeid.length > 0) {
        PhasedProvider.viewType = 'active';
//         $http.post('./api/pays/find', {customer: stripeid,sub:subid})
//           .then(function(res){
//         		var data = res.data;
//             if (data.err) {
//               console.log(data.err);
//               // handle error
//             }

//             if (data.status == "active") {
//               //Show thing for active
//               PhasedProvider.viewType = 'active';

//             } else if (data.status == "trialing") {
//               //Show thing for problem with account
//               PhasedProvider.viewType = 'trialing';
//             } else if (data.status == 'past_due' || data.status == 'unpaid') {
//               //Show thing for problem with account
//               PhasedProvider.viewType = 'problem';
//             } else if (data.status == 'canceled') {
//               //Show thing for problem with canceled
//               PhasedProvider.viewType = 'canceled';
//             }

//             _maybeBounceTeam()
//             $rootScope.$broadcast('Phased:PaymentInfo');
//           }, function(data){
//             console.log(data);
//           });
      } else {
        PhasedProvider.viewType = 'active';
        //PhasedProvider.viewType = 'notPaid';
        //_maybeBounceTeam();
      }
    }


    /*
    **
    **  WATCHING FUNCTIONS
    **
    */

    /*
    *
    * watchTeam
    * sets up other firebase data event handlers for team data
    * including statuses, projects/cards/statuses, team membership
    *
    * stores for de-registering when switching teams
    *
    */
    var watchTeam = function() {
      var teamKey = 'team/' + PhasedProvider.team.uid,
        cb = '', // set to callback for each FBRef.on()
        now = new Date().getTime();

      // name
      cb = FBRef.child(teamKey + '/name').on('value', function(snap){
        PhasedProvider.team.name = snap.val();
      });

      PhasedProvider.team._FBHandlers.push({
        address : teamKey + '/name',
        eventType : 'value',
        callback : cb
      });


      // statuses
      // adds the status if it's not already there
      cb = FBRef.child(teamKey + '/statuses')
      .orderByChild('time').startAt(now)
      .on('child_added', function(snap){
        var key = snap.key();
        if (!(key in PhasedProvider.team.statuses)) {
        	$rootScope.$evalAsync(function() {
	          PhasedProvider.team.statuses[key] = snap.val();
	        	$rootScope.$broadcast('Phased:newStatus');
	        });
        }
      });

      PhasedProvider.team._FBHandlers.push({
        address : teamKey + '/statuses',
        eventType : 'child_added',
        callback : cb
      });

      // update status on change
      cb = FBRef.child(teamKey + '/statuses')
      .limitToLast(STATUS_LIMIT)
      .on('child_changed', function(snap) {
        var key = snap.key();
        $rootScope.$evalAsync(function(){
	        PhasedProvider.team.statuses[key] = snap.val();
	        $rootScope.$broadcast('Phased:changedStatus');
	      });
      });

      PhasedProvider.team._FBHandlers.push({
        address : teamKey + '/statuses',
        eventType : 'child_changed',
        callback : cb
      });

      // update status on change
      cb = FBRef.child(teamKey + '/statuses')
      .limitToLast(STATUS_LIMIT)
      .on('child_removed', function(snap) {
        var key = snap.key();
        $rootScope.$evalAsync(function(){
	        delete PhasedProvider.team.statuses[key];
	        $rootScope.$broadcast('Phased:deletedStatus');
        });
      });

      PhasedProvider.team._FBHandlers.push({
        address : teamKey + '/statuses',
        eventType : 'child_changed',
        callback : cb
      });


      // category (doesn't need memory references)
      cb = FBRef.child(teamKey + '/category').on('value', function(snap) {
        var data = snap.val();
        $rootScope.$evalAsync(function(){
        	PhasedProvider.team.categoryObj = data;
       		PhasedProvider.team.categorySelect = objToArray(data); // adds key prop
        });
      });

      PhasedProvider.team._FBHandlers.push({
        address : teamKey + '/category',
        eventType : 'value',
        callback : cb
      });

      // repos
      cb = FBRef.child(teamKey + '/repos').on('value', function(snap){
      	$rootScope.$evalAsync(function() {
      		PhasedProvider.team.repos = snap.val();
      	});
      });

      PhasedProvider.team._FBHandlers.push({
        address : teamKey + '/repos',
        eventType : 'value',
        callback : cb
      });


      // slack
      cb = FBRef.child(teamKey + '/slack').on('value', function(snap){
      	$rootScope.$evalAsync(function(){
	      	PhasedProvider.team.slack = snap.val();
	      });
      });

      PhasedProvider.team._FBHandlers.push({
        address : teamKey + '/slack',
        eventType : 'value',
        callback : cb
      });


      // billing
      cb = FBRef.child(teamKey + '/billing').on('value', function(snap){
        var billing = snap.val();
        $rootScope.$evalAsync(function() {
        	checkPlanStatus(billing.stripeid, billing.subid);
        });
      });

      PhasedProvider.team._FBHandlers.push({
        address : teamKey + '/billing',
        eventType : 'value',
        callback : cb
      });


      // members
      cb = FBRef.child(teamKey + '/members').on('child_changed', function(snap) {
      	$rootScope.$evalAsync(function() {
	        var memberID = snap.key(),
	          data = snap.val();

	        // if new member, initialize
	        if (!(memberID in PhasedProvider.team.members)) {
	          initializeMember(memberID);
	        }

	        // update all keys as needed
	        for (var key in data) {
	          PhasedProvider.team.members[memberID][key] = data[key];
	        }

	        // update teamLength
	        PhasedProvider.team.teamLength = Object.keys(PhasedProvider.team.members).length;

	        $rootScope.$broadcast('Phased:memberChanged');
	      });
      });

      PhasedProvider.team._FBHandlers.push({
        address : teamKey + '/members',
        eventType : 'child_changed',
        callback : cb
      });
    }

    /*
    *
    * unwatchTeam
    * prepares us to switch to another team by un-setting the active
    * firebase event handlers
    *
    */
    var unwatchTeam = function() {
      var count = 0;
      // unwatch all team watchers
      for (var i in PhasedProvider.team._FBHandlers) {
        var handler = PhasedProvider.team._FBHandlers[i];
        FBRef.child(handler.address).off(handler.eventType, handler.callback);
        count++;
      }
      PhasedProvider.team._FBHandlers = [];
      console.log(count + ' team event handlers removed.');

      // unwatch all team members
      count = 0;
      for (var i in PhasedProvider.team.members) {
        var handlers = PhasedProvider.team.members[i]._FBHandlers;
        for (var j in handlers) {
          FBRef.child(handlers[j].address).off(handlers[j].eventType, handlers[j].callback);
          count++;
        }
        PhasedProvider.team.members[i]._FBHandlers = [];
      }
      console.log(count + ' member event handlers removed.');

      // unlink get
      PhasedProvider.get = {
        tasks : {},
        columns : {},
        cards : {}
      }
    }

    /**
    *
    * gathers notifications for current user
    * adds to PhasedProvider.notif.stream
    *
    * tells server to clean up old, read notifs for the user
    *
    */
    var watchNotifications = function() {

      // returns the interpreted string version of the title or body obj
      var stringify = function(obj) {
        // if obj is already a string, spit it out
        if ((typeof obj).toLowerCase() == 'string')
          return obj;

        var out = '';
        for (var j in obj) {
          if (obj[j].string) {
            out += obj[j].string;
          } else if (obj[j].userID) {
            if (obj[j].userID == PhasedProvider.user.uid) // use "you" for current user
              out += 'you';
            else

              out += PhasedProvider.team.members[obj[j].userID].name;
          }
        }

        return out;
      }

      registerAfterMembers(function doWatchNotifications(){
        // clean notifications once
        $http.post('./api/notification/clean', {
          user: PhasedProvider.user.uid,
          team : PhasedProvider.team.uid
        }).then(function(res) {
        	var data = res.data;
            if (data.success) {
              // console.log('clean notifications success', data);
            } else {
              console.log('clean notifications error', data);
            }
          },
          function(data){
            console.log('err', data.error());
          });

        // set up watcher
        var notifAddress = 'notif/' + PhasedProvider.team.uid + '/' + PhasedProvider.user.uid;
        var cb = FBRef.child(notifAddress)
        	.limitToLast(NOTIF_LIMIT)
          .on('value', function(snap) {
          	$rootScope.$evalAsync(function(){
	            var notifications = snap.val();

	            // format titles and bodies
	            for (var id in notifications) {
	              notifications[id].title = stringify(notifications[id].title);
	              notifications[id].body = stringify(notifications[id].body);
	              notifications[id].key = id;
	            }
	            // update stream
	            PhasedProvider.notif.stream = notifications;

	            // issue notification event
	            $rootScope.$broadcast('Phased:notification');
	          });
          });

        // stash for deregistering
        PhasedProvider.team._FBHandlers.push({
          address : notifAddress,
          eventType : 'value',
          callback : cb
        });
      });
    }

    /**
    *
    * Monitors current user's presence
    *
    * NB: must be called after meta are in
    *
    * 1. sets their presence to PhasedProvider.PRESENCE_ID.ONLINE when connected
    *
    * 2. sets their presence attr to PhasedProvider.PRESENCE_ID.OFFLINE
    * and updates lastOnline on FB disconnect
    *
    */
    var watchPresence = function() {
      if (!('uid' in PhasedProvider.team) || typeof PhasedProvider.team.uid != 'string') {
        console.log('Cannot watch presence for user not on a team');
        return;
      }

      FBRef.child('.info/connected').on('value', function(snap){
        // we're connected, handle this stuff
        if (snap.val() == true) {
          // 1. immediately set us to "present"
          FBRef.child('team/' + PhasedProvider.team.uid + '/members/' + PhasedProvider.user.uid).update({
            presence : PhasedProvider.PRESENCE_ID.ONLINE
          });

          // 2. register disconnect handler
          FBRef.child('team/' + PhasedProvider.team.uid + '/members/' + PhasedProvider.user.uid).onDisconnect().update({
            lastOnline : Firebase.ServerValue.TIMESTAMP,
            presence : PhasedProvider.PRESENCE_ID.OFFLINE
          });
        }
      });

      // go "offline" when deauthenticated
      FBRef.onAuth(function(authData){
        if (!authData) {
          FBRef.child('team/' + PhasedProvider.team.uid + '/members/' + PhasedProvider.user.uid).update({
            lastOnline : Firebase.ServerValue.TIMESTAMP,
            presence : PhasedProvider.PRESENCE_ID.OFFLINE
          });
        }
      });
    }


		/**
		*
		*	Keeps registered google calendars synced
		*
		*	list is indexed by google cal ID, not FB key
		*	(FB key available at .FBKey)
		*
		*	NB: This does NOT synch google calendars with
		*		the Google server; see doGetGoogleCalendars
		*
		*/
    var watchGoogleCalendars = function() {
    	var doUpdateCals = function(snap) {
				var data = snap.val();
				var list = {};
				// reorganize to index by google cal ID
				for (var i in data) {
					data[i].FBKey = i;
					list[data[i].id] = data[i];
				}
				PhasedProvider.user.registeredCalendars = list;
  		};

  		// watch current team
    	FBRef.child('integrations/google/calendars/' + _Auth.user.uid + '/' + PhasedProvider.team.uid).on('value', doUpdateCals);

    	// when team switches, unwatch old team and watch new team
  		$rootScope.$on('Phased:switchedTeam', function(e, args) {
  			FBRef.child('integrations/google/calendars/' + _Auth.user.uid + '/' + args.oldTeamID).off();
  			FBRef.child('integrations/google/calendars/' + _Auth.user.uid + '/' + args.newTeamID).on('value', doUpdateCals);
  		});
    }

    /**
    *
    * Watches a team's projects, keeping them in sync with FireBase
    *
    * A slightly recursive function. It watches all projects (via
    * child_added) with watchOneProject, which calls watchAllColumns,
    * which calls watchOneColumn on each of that project's columns,
    * which calls wachAllCards and so on.
    *
    * in short, we need to add a watch at each level:
    * /projects
    *   -- /$projID
    *       |- /columns
    *         -- /$colID
    *           |- /cards
    * etc.
    *
    * Should only be called from watchTeam if WATCH_PROJECTS is set.
    * Replaces watchAssignments().
    * Stashes all even listeners in the team's _FBHandlers for
    * deregistration when switching teams.
    *
    */
    var watchProjects = function watchProjects() {
      var projAddr = 'team/' + PhasedProvider.team.uid + '/projects',
        projectsRef = FBRef.child(projAddr),
        cb;

      // observe when tasks are added to or removed from a card
      var watchAllTasks = function watchAllTasks(cardID, colID, projID, cardRef) {
        var cb = '';
        cb = cardRef.child('tasks').on('child_added', function tasksChildAdded(snap){
        	$rootScope.$evalAsync(function tasksChildAddedCB(){
	          var taskID = snap.key();
	          PhasedProvider.team.projects[DEFAULTS.projectID].columns[DEFAULTS.columnID].cards[DEFAULTS.cardID].tasks[taskID] = snap.val();
	          PhasedProvider.get.tasks[taskID] = PhasedProvider.team.projects[DEFAULTS.projectID].columns[DEFAULTS.columnID].cards[DEFAULTS.cardID].tasks[taskID];
	          watchOneTask(taskID, DEFAULTS.cardID, DEFAULTS.columnID, DEFAULTS.projectID);
	          $rootScope.$broadcast('Phased:taskAdded');
	          maybeDoAfterProjects();
	        });
        });
        PhasedProvider.team._FBHandlers.push({
          address : cardRef.child('tasks').key(),
          eventType : 'child_added',
          callback : cb
        });

        cb = cardRef.child('tasks').on('child_removed', function tasksChildRemoved(snap){
        	$rootScope.$evalAsync(function tasksChildRemovedCB(){
	          delete PhasedProvider.get.tasks[snap.key()];
	          delete PhasedProvider.team.projects[projID].columns[DEFAULTS.columnID].cards[DEFAULTS.cardID].tasks[snap.key()];
	          $rootScope.$broadcast('Phased:taskDeleted');
	        });
        });

        PhasedProvider.team._FBHandlers.push({
          address : cardRef.child('tasks').key(),
          eventType : 'child_removed',
          callback : cb
        });
      }
      var watchOneTask = function watchOneTask(taskID) {
        var thisTaskAddr = DEFAULTS.projectID + '/columns/' + DEFAULTS.columnID + '/cards/' + DEFAULTS.cardID + '/tasks/' + taskID;
        var taskRef = projectsRef.child(thisTaskAddr);
        var cb = '';

        cb = taskRef.on('child_changed', function taskChildChanged(snap) {
        	$rootScope.$evalAsync(function taskChildChangedCB(){
          	PhasedProvider.team.projects[DEFAULTS.projectID].columns[DEFAULTS.columnID].cards[DEFAULTS.cardID].tasks[taskID][snap.key()] = snap.val();
          });
        });
        PhasedProvider.team._FBHandlers.push({
          address : projAddr + '/' + thisTaskAddr,
          eventType : 'child_changed',
          callback : cb
        });

        cb = taskRef.on('child_added', function taskChildAdded(snap){
        	$rootScope.$evalAsync(function taskChildAddedCB(){
          	PhasedProvider.team.projects[DEFAULTS.projectID].columns[DEFAULTS.columnID].cards[DEFAULTS.cardID].tasks[taskID][snap.key()] = snap.val();
          });
        });
        PhasedProvider.team._FBHandlers.push({
          address : projAddr + '/' + thisTaskAddr,
          eventType : 'child_added',
          callback : cb
        });

        cb = taskRef.on('child_removed', function taskChildRemoved(snap){
        	$rootScope.$evalAsync(function taskChildRemovedCB(){
          	delete PhasedProvider.team.projects[DEFAULTS.projectID].columns[DEFAULTS.columnID].cards[DEFAULTS.cardID].tasks[taskID][snap.key()];
          });
        });
        PhasedProvider.team._FBHandlers.push({
          address : projAddr + '/' + thisTaskAddr,
          eventType : 'child_removed',
          callback : cb
        });
      }

      var _loadedTasks = 0,
      	_totalTasks = Object.keys(PhasedProvider.get.tasks).length;

      // we have all the tasks, but we need to tell when all tasks have been
      // loaded with child_added so that Phased:setup is broadcast after their own Phased:taskAdded
      var maybeDoAfterProjects = function maybeDoAfterProjects() {
      	_loadedTasks++;
      	// this condition will be true when the very last task has been called
      	if (!PHASED_PROJECTS_SET_UP && _loadedTasks == _totalTasks) {
      		doAfterProjects();
      	}
      }

      var cardRef = FBRef.child('team/' + PhasedProvider.team.uid + '/projects/' + DEFAULTS.projectID + '/columns/' + DEFAULTS.columnID + '/cards/' + DEFAULTS.cardID);
      watchAllTasks(DEFAULTS.cardID, DEFAULTS.columnID, DEFAULTS.projectID, cardRef);
    }



    /*
    **
    **  INTERNAL UTILITIES
    **
    **  utilities for
    **  - issuing notifications
    **  - updating an object's history
    **  - cleaning data to go to database
    **  - JS utilities (popFromList and objToArray)
    */

    /**
    *
    * issues a notification to every member on the team
    * (server does heavy lifting)
    *
    * title and body are arrays of objects which are either
    * { string : 'a simple string' }
    * or { userID : 'aUserID' }
    * which will be interpreted when loaded by client (see watchNotifications)
    *
    * example
    * {
    *   title : [{string: 'A simple notification'}]
    *   body : [{string: 'this is an example notification'}]
    *   type : PhasedProvider.NOTIF_TYPE_ID.STATUS // or whatever is applicable
    * }
    *
    */
    var issueNotification = function(notification, meta) {
      $http.post('./api/notification/issue', {
        user: _Auth.user.uid,
        team : _Auth.currentTeam,
        notification : JSON.stringify(notification),
        meta : JSON.stringify(meta || {})
      }).then(function(res) {
        	var data = res.data;
            if (res.status == 200 && data.success) {
              // console.log('IssueNotif success', data);
            } else {
              console.log('IssueNotif error', data);
            }
        }, function(data){
          console.log('err', data.error());
        });
    }

    /**
    *
    * Formats and issues a notification for a task history update
    *
    * @arg data is just the object in the task's history stream
    *
    */
    var issueTaskHistoryNotification = function(data) {
      var streamItem = {}, meta = {};
      switch (data.type) {
        /**
        *   TASK CREATED
        */
        case PhasedProvider.task.HISTORY_ID.CREATED :
          streamItem = {
            body : [{string : data.snapshot.name}],
            cat : data.snapshot.cat,
            type : PhasedProvider.NOTIF_TYPE_ID.ASSIGNMENT_CREATED
          };

          // make title :
          // 1 assigned to someone else
          // 2 self-assigned
          // 3 unassigned

          if (data.snapshot.assigned_by != data.snapshot.assigned_to &&
            (data.snapshot.assigned_to && !data.snapshot.unassigned)) { // 1
              streamItem.title = [
                { string : 'New task assigned to ' },
                { userID : data.snapshot.assigned_to },
                { string : ' by ' },
                { userID : data.snapshot.assigned_by }
              ];
              meta = {
                assignedBy : data.snapshot.assigned_by,
                assignedTo : data.snapshot.assigned_to,
                taskName : data.snapshot.name
              }
          } else if (data.snapshot.assigned_by == data.snapshot.assigned_to) { // 2
            streamItem.title = [
              { userID : data.snapshot.assigned_by },
              { string : ' self-assigned a new task' }
            ];
          } else if (data.snapshot.unassigned) { // 3.
            streamItem.title = [
              { userID : data.snapshot.assigned_by},
              { string : ' created a new unassigned task'}
            ]
          } else {
            console.warn('Issuing task history notification failed -- bad title');
            return;
          }
          break;
        /**
        *   TASK ARCHIVED
        *   nb: an archived task snapshot could appear in an active task's history
        */
        case PhasedProvider.task.HISTORY_ID.ARCHIVED :
          streamItem = {
            title : [{ string : 'Task archived' }],
            body : [{ string : data.snapshot.name }],
            cat : data.snapshot.cat,
            type : PhasedProvider.NOTIF_TYPE_ID.ASSIGNMENT_ARCHIVED
          }
          break;
        /**
        *   TASK UNARCHIVED
        */
        case PhasedProvider.task.HISTORY_ID.UNARCHIVED :
          streamItem = {
            title : [{ string : 'Task unarchived' }],
            body : [{ string : data.snapshot.name }],
            cat : data.snapshot.cat,
            type : PhasedProvider.NOTIF_TYPE_ID.ASSIGNMENT_UNARCHIVED
          }
          break;
        /**
        *   TASK NAME CHANGED
        */
        case PhasedProvider.task.HISTORY_ID.NAME :
          streamItem = {
            title : [{ string : 'Task name changed' }],
            body : [{ string : 'to "' + data.snapshot.name + '"' }],
            cat : data.snapshot.cat,
            type : PhasedProvider.NOTIF_TYPE_ID.ASSIGNMENT_UPDATED
          }
          break;
        /**
        *   TASK DESC CHANGED
        */
        case PhasedProvider.task.HISTORY_ID.DESCRIPTION :
          streamItem = {
            title : [{ string : 'Task description changed' }],
            body : [{ string : data.snapshot.name }],
            cat : data.snapshot.cat,
            type : PhasedProvider.NOTIF_TYPE_ID.ASSIGNMENT_UPDATED
          }
          break;

        /**
        *   TASK ASSIGNEE CHANGED
        */
        case PhasedProvider.task.HISTORY_ID.ASSIGNEE :
          streamItem = {
            title : [
              { string : 'Task assigned to '},
              { userID : data.snapshot.assigned_to }
            ],
            body : [{ string : data.snapshot.name }],
            cat : data.snapshot.cat,
            type : PhasedProvider.NOTIF_TYPE_ID.ASSIGNMENT_ASSIGNED
          };
          meta = {
          	assignedBy : data.snapshot.assigned_by,
          	assignedTo : data.snapshot.assigned_to,
          	taskName : data.snapshot.name
          }
          break;
        /**
        *   TASK DEADLINE CHANGED
        */
        case PhasedProvider.task.HISTORY_ID.DEADLINE :
          streamItem = {
            title : [{ string : 'Task deadline changed' }],
            body : [{ string : data.snapshot.name }],
            cat : data.snapshot.cat,
            type : PhasedProvider.NOTIF_TYPE_ID.ASSIGNMENT_UPDATED
          }
          break;
        /**
        *   TASK PRIORITY CHANGED
        */
        case PhasedProvider.task.HISTORY_ID.CATEGORY :
          streamItem = {
            title : [{ string : 'Task category changed' }],
            body : [{ string : data.snapshot.name }],
            cat : data.snapshot.cat,
            type : PhasedProvider.NOTIF_TYPE_ID.ASSIGNMENT_UPDATED
          }
          break;

        /**
        *   TASK PRIORITY CHANGED
        */
        case PhasedProvider.task.HISTORY_ID.PRIORITY :
          streamItem = {
            title : [{ string : 'Task priority changed' }],
            body : [{ string : data.snapshot.name }],
            cat : data.snapshot.cat,
            type : PhasedProvider.NOTIF_TYPE_ID.ASSIGNMENT_UPDATED
          }
          break;

        /**
        *   TASK STATUS CHANGED
        */
        case PhasedProvider.task.HISTORY_ID.STATUS :
          streamItem = {
            title : [{ string : 'Task status changed' }],
            body : [{ string : data.snapshot.name }],
            cat : data.snapshot.cat,
            type : PhasedProvider.NOTIF_TYPE_ID.ASSIGNMENT_STATUS
          }
          switch (data.snapshot.status) {
            case PhasedProvider.task.STATUS_ID.IN_PROGRESS :
              streamItem.title = [{ string : 'Task in progress' }];
              break;
            case PhasedProvider.task.STATUS_ID.COMPLETE :
              streamItem.title = [{ string : 'Task completed' }];
              break;
            case PhasedProvider.task.STATUS_ID.ASSIGNED :
              streamItem.title = [{ string : 'Task assigned' }];
              break;
            default:
              break;
          }
          break;
        /**
        *   TASK UPDATED (generic)
        */
        default :
          streamItem = {
            title : [{ string : 'Task updated' }],
            body : [{ string : data.snapshot.name }],
            cat : data.snapshot.cat,
            type : PhasedProvider.NOTIF_TYPE_ID.ASSIGNMENT_UPDATED
          }
          break;
      }

      issueNotification(streamItem, meta);
    }

    /**
    *
    * updates the task's history with the following object type:
    * {
    *  time : [current timestamp],
    *  type : [type of operation, reference to code in PhasedProvider.TASK_HISTORY_CHANGES],
    *  taskSnapshot : [copy of the task at this time, minus the history object]
    * }
    *
    * also issues a notification to the team.
    *
    * needs args.FBRef and args.task, but can make both of these with args.taskID.
    * fails if one of FBRef or task are missing AND taskID is also missing.
    *
    * args = {
    *   task : task, // optional. task object to make snapshot of.
    *   taskID : taskID, // optional. task's ID
    *   taskRef : taskRef // optional. reference to task in Firebase
    *   type : type // REQUIRED. type of history update.
    *  }
    *
    * 0. decide whether to fail
    * 1. gather information:
    *   1A. get taskRef if not supplied
    *   1B. get task if not supplied
    *   1C. create the snapshot
    * 2. update db
    * 3. issue notification
    *
    */

    var updateTaskHist = function(args) {
      var ids;

      // 0. decide if we have enough info to continue
      if (
          (
            (
              !('taskRef' in args) || !('task' in args) // either of taskRef or task are missing
            ) &&
            !('taskID' in args) // and taskID is also missing
          ) || (
            !('type' in args) // or type is missing
          )
        ) {
        console.error('Phased.updateTaskHist failed: not enough information');
        return false;
      }

      // 1A. get taskRef if not present
      var taskRef = args.taskRef
      if (!(args.taskRef)) {
        ids = find(args.taskID, 'task');
        taskRef = FBRef.child(ids.FBAddr);
      }

      // 1B. get task if not present
      var task = args.task;
      if (!(args.task)) {
        if (!ids)
          ids = find(args.taskID, 'task'); // only do this when needed

        task = PhasedProvider.team.projects[ids.projID].columns[ids.colID].cards[ids.cardID].tasks[ids.taskID];
      }

      // 1C. create the snapshot by removing the history obj
      task = angular.copy(task);
      delete task.history;

      var data = {
        time : Firebase.ServerValue.TIMESTAMP,
        type : args.type, // history type
        snapshot : task
      }

      // 2. update history in DB
      taskRef.child('history').push(data);

      // 3. format and issue notification
      issueTaskHistoryNotification(data);
    }

    /**
    *
    * finds a column, card, or task in the project tree
    * returns an object with the project, column, card, task IDs
    * also generates an address to that item in firebase
    *
    * NB: somewhat expensive operation; try to avoid if you already have
    * the IDs or a FBRef somewhere else
    *
    */
    var find = function(needleID, type) {
      var teamAddr = 'team/' + PhasedProvider.team.uid;
      var out;

      // traverses levels of the project tree
      var walker = function(haystack, callback) {
        for (var i in haystack) {
          callback(haystack[i], i);
        }
      }

      // find column
      if (type.toLowerCase().indexOf('col') >= 0) {
        walker(PhasedProvider.team.projects, function(project, projID) {
          walker(project.columns, function(column, colID) {
            if (colID == needleID)
              out = {
                projID : projID,
                colID : colID,
                FBAddr : teamAddr + '/projects/' + projID + '/columns/' + colID
              };
          });
        });
      }
      // find card
      else if (type.toLowerCase() == 'card') {
        walker(PhasedProvider.team.projects, function(project, projID) {
          walker(project.columns, function(column, colID) {
            walker(column.cards, function(card, cardID) {
              if (cardID == needleID)
                out = {
                  projID : projID,
                  colID : colID,
                  cardID : cardID,
                  FBAddr : teamAddr + '/projects/' + projID + '/columns/' + colID + '/cards/' + cardID
                };
            });
          });
        });
      }
      // find task
      else if (type.toLowerCase() == 'task' || type.toLowerCase() == 'assignment') {
        walker(PhasedProvider.team.projects, function(project, projID) {
          walker(project.columns, function(column, colID) {
            walker(column.cards, function(card, cardID) {
              walker(card.tasks, function(task, taskID) {
                if (taskID == needleID)
                  out = {
                    projID : projID,
                    colID : colID,
                    cardID : cardID,
                    taskID : taskID,
                    FBAddr : teamAddr + '/projects/' + projID + '/columns/' + colID + '/cards/' + cardID + '/tasks/' + taskID
                  };
              });
            });
          });
        });
      }

      return out;
    }

    /**
    *
    * cleanObjectShallow()
    *
    * performs a single-level cleaning of an incoming associative array
    * ensuring required nodes are present and allowing optional nodes
    * returns a pristine copy of dirtyObj (ie, a new object) or false if
    * required nodes are missing
    *
    * expects config to have two properties, 'required' & 'optional',
    * which themselves have type-organized lists of node names, ie
    *
    *  config = {
    *    required : {
    *      strings : [],
    *      numbers : [],
    *      booleans : []
    *    },
    *    optional : {
    *      strings : [],
    *      numbers : [],
    *      booleans : []
    *    }
    *  }
    *
    */
    var cleanObjectShallow = function(dirtyObj, config) {
      var cleanObj = {},
        required = config.required,
        optional = config.optional;

      // REQUIRED:
      if ('required' in config) {
        // required strings
        for (var i in required.strings) {
          if (typeof dirtyObj[required.strings[i]] === 'string' &&
              dirtyObj[required.strings[i]] != '') {
            cleanObj[required.strings[i]] = dirtyObj[required.strings[i]];
          } else {
            console.log('required property "' + required.strings[i] + '" not found; aborting');
            return false;
          }
        }

        // required numbers
        for (var i in required.numbers) {
          if (typeof dirtyObj[required.numbers[i]] === 'number' &&
              !isNaN(dirtyObj[required.numbers[i]])) {
            cleanObj[required.numbers[i]] = dirtyObj[required.numbers[i]];
          } else {
            console.log('required property "' + required.numbers[i] + '" not found or is NaN; aborting');
            return false;
          }
        }

        // booleans
        for (var i in required.booleans) {
          if (typeof dirtyObj[required.booleans[i]] === 'boolean') {
            cleanObj[required.booleans[i]] = dirtyObj[required.booleans[i]];
          } else {
            console.log('required property "' + required.booleans[i] + '" not found; aborting');
            return false;
          }
        }
      }

      // OPTIONAL
      if ('optional' in config) {
        // optional strings
        for (var i in optional.strings) {
          if (typeof dirtyObj[optional.strings[i]] === 'string' &&
              dirtyObj[optional.strings[i]] != '') {
            cleanObj[optional.strings[i]] = dirtyObj[optional.strings[i]];
          }
        }

        // optional numbers
        for (var i in optional.numbers) {
          if (typeof dirtyObj[optional.numbers[i]] === 'number'
            && !isNaN(dirtyObj[optional.numbers[i]])) {
            cleanObj[optional.numbers[i]] = dirtyObj[optional.numbers[i]];
          }
        }

        // booleans
        for (var i in optional.booleans) {
          if (typeof dirtyObj[optional.booleans[i]] === 'boolean') {
            cleanObj[optional.booleans[i]] = dirtyObj[optional.booleans[i]];
          }
        }
        // objects
        for (var i in optional.objects) {
          if (typeof dirtyObj[optional.objects[i]] === 'object') {
            cleanObj[optional.objects[i]] = dirtyObj[optional.objects[i]];
          }
        }
      }

      return cleanObj;
    }

    // cleans a project ~~ STUB
    var cleanProject = function(newProject) {

    }

    // cleans a column ~~ STUB
    var cleanColumn = function(newColumn) {

    }

    // cleans a card ~~ STUB
    var cleanCard = function(newCard) {

    }

    // cleans an assignment
    var cleanAssignment = function(newAssignment, includeHist) {
      // properties to check
      var config = {
          required : {
          strings : ['name', 'created_by', 'assigned_by']
        },
        optional : {
          strings : ['cat', 'taskPrefix', 'photo', 'assigned_to'],
          numbers : ['deadline', 'priority', 'status'],
          booleans : ['unassigned']
        }
      };

      var assignment = cleanObjectShallow(newAssignment, config);

      // check for history
      if (includeHist) {
        assignment.history = angular.copy(newAssignment.history); // copies and removes $$hashkeys
      }

      return assignment;
    }

    // cleans a status
    var cleanStatus = function(newStatus) {
      // properties to check
      var config = {
          required : {
          strings : ['name', 'user']
        },
        optional : {
          strings : ['cat', 'taskPrefix'],
          objects : ['task']
        }
      };

      var newStatus = cleanObjectShallow(newStatus, config);

      newStatus.type = PhasedProvider.status.TYPE_ID.UPDATE;
      newStatus.source = PhasedProvider.status.SOURCE_ID.WEBAPP;

      return newStatus;
    }

    // remove an item from an array
    // returns the new array
    var popFromList = function(item, list) {
      if (!('indexOf' in list)) {
        list = objToArray(list); // change list to array if it's an object
      }
      var i = list.indexOf(item);
      while (i > -1) {
        delete list[i];
        i = list.indexOf(item);
      }
      return list;
    }

    // convert object into array
    // returns the new array
    // useful for arrays with missing keys
    // eg, [0 = '', 1 = '', 3 = ''];
    var objToArray = function(obj) {
      var newArray = [];
      for (var i in obj) {
        if (typeof obj[i] == 'object' || typeof obj[i] == 'function')
          obj[i].key = i;
        newArray.push(obj[i]);
      }
      return newArray;
    }




    /**
    **
    ** EXPOSED FUNCTIONS
    ** all registered as callbacks with registerAsync()
    **
    **/

    /**

      General account and team things

    **/

    /**
    *
    * adds a member
    * Brian's better add member function
    * 1. checks if member is in /profile
    * 2A. if so, registers current team on member's profile and adds to our team
    * 2B. if not, checks whether they are a profile in waiting
    * 2B1. if they are, add team to newMember's profile
    * 2B2. if not, add to /profile-in-waiting and /profile-in-waiting2
    */

    var _addMember = function(newMember) {
      console.log(newMember);
      var args = {
        newMember : newMember
      }

      registerAsync(doAddMember, args);
    }

    var doAddMember = function(args) {
      console.log(args);
      ga('send', 'event', 'Team', 'Member invited');
      $http.post('./api/registration/invite', {
        invitedEmail: args.newMember.email,
        inviterEmail : PhasedProvider.user.email,
        inviterName : PhasedProvider.user.name,
        team : PhasedProvider.team.uid,
        teamName : PhasedProvider.team.name
      })
      .then(function(res) {
      	var data = res.data;
        if (data.success) {
          if (data.added) {
            issueNotification({
              title : [{userID : data.userID}, {string : ' has joined your team'}],
              body : [],
              type : PhasedProvider.NOTIF_TYPE_ID.USER_JOINED
            });
            $rootScope.$broadcast('Phased:inviteSuccess');
          } else if (data.invited) {
            $rootScope.$broadcast('Phased:inviteSuccess');
          }
        } else {
          console.log('err', data);
          $rootScope.$broadcast('Phased:inviteFailed');
        }
      },
      function(data){
        console.log('err', data);
        $rootScope.$broadcast('Phased:inviteFailed');
      });
    }

    /**
    *
    * adds a team
    * function mostly copied from chromeapp ctrl-createTeam.js
    * 1. offload work to server
    * 2A. if making team was successful, switch to that team
    * 2B. if it already exists, run fail callback
    */

    var _addTeam = function(teamName,email, success, failure, addToExistingTeam) {
      var args = {
        teamName : teamName,
        email :email,
        success : success,
        failure : failure,
        addToExistingTeam : typeof addToExistingTeam === 'boolean' ? addToExistingTeam : false // only use value if set
      }
      registerAfterMeta(doAddTeam, args); // can be called before Phased team but needs Meta
    }

    var doAddTeam = function(args) {
      // 1.
      $http.post('./api/registration/registerTeam', {
        userID : PhasedProvider.user.uid,
        teamName : args.teamName
      })
      .then(function(res){
        var data = res.data;
        if (data.success) {
          ga('send', 'event', 'Team', 'team added');
          // 2A. switch to that team
          doSwitchTeam({
            teamID : data.teamID,
            callback : args.success
          });
        } else {
          // fail
          console.log(data);
          if (typeof args.failure == 'function')
            args.failure(args.teamName);
        }
      }, function(error){
        // 2B. fail!
        console.log(error);
        if (typeof args.failure == 'function')
          args.failure(args.teamName);
      })
    }


    /**
    *
    * switches current user's active team
    * optionally calls a callback
    * broadcasts Phased:switchedTeam
    */

    var _switchTeam = function(teamID, callback) {
      var args = {
        teamID : teamID,
        callback : callback
      }
      registerAsync(doSwitchTeam, args);
    }

    var doSwitchTeam = function(args) {
      // set SET_UP to false to trigger doAsync
      PHASED_SET_UP = PhasedProvider.SET_UP = false;

      // stash team
      var oldTeam = typeof PhasedProvider.team.uid == 'string' ? PhasedProvider.team.uid + '' : false;

      // remove old event handlers
      unwatchTeam();

      // reload team data
      PhasedProvider.team.uid = args.teamID;
      _Auth.currentTeam = args.teamID;
      initializeTeam();

      if (WATCH_NOTIFICATIONS)
        watchNotifications();

      // update user curTeam
      FBRef.child('profile/' + _Auth.user.uid + '/curTeam').set(args.teamID, function(err) {
        // switch back on error
        if (err && !('recursing' in args)) {
          doSwitchTeam({teamID : oldTeam, recursing : true});
          return;
        }
        // execute callback if it exists
        if (typeof args.callback == 'function')
          args.callback();
        ga('send', 'event', 'Team', 'Team switched');

        $rootScope.$broadcast('Phased:switchedTeam', {oldTeamID : oldTeam, newTeamID : PhasedProvider.team.uid});
      });

      // update presence information for both teams
      if (WATCH_PRESENCE) {
        if (oldTeam) {
          // cancel old handler
          FBRef.child('team/' + oldTeam + '/members/' + PhasedProvider.user.uid).onDisconnect().cancel();
          // go offline for old team
          FBRef.child('team/' + oldTeam + '/members/' + _Auth.user.uid).update({
            presence : PhasedProvider.PRESENCE_ID.OFFLINE,
            lastOnline : Firebase.ServerValue.TIMESTAMP
          });
        }
        // go online and set new handler for current team
        watchPresence();
      }

      if (WATCH_INTEGRATIONS) {
      	watchGoogleCalendars();
      }
    }

    /**
    *
    * changes any member's role
    *
    * FB additionally validates security and data type, but we do it here
    * also for speed. Reverts ID and calls failure function on failure.
    *
    * 1. check own role
    * 2. validate new data type
    * 3. validate member is on team
    * 4. update DB
    *
    */

    var _changeMemberRole = function(memberID, newRole, oldRole, failure) {
      var args = {
        memberID : memberID,
        newRole : newRole,
        oldRole : oldRole,
        failure : failure
      }
      console.log(args);
      registerAsync(doChangeMemberRole, args);
    }

    var doChangeMemberRole = function(args) {
      // convenience for checking args.failure before calling
      var fail = function(code, message) {
        if (typeof args.oldRole == 'number') // revert if possible
          PhasedProvider.team.members[args.memberID].role = args.oldRole;
        if (typeof args.failure == 'function') // call failure callback if possible
          args.failure(code, message);
        return;
      }

      // 1. check own auth
      var myRole = PhasedProvider.team.members[PhasedProvider.user.uid].role;
      // changes in the model are immediate (jeez, thanks angular) so if we're changing our own role,
      // we need to use the old value
      if (args.memberID == PhasedProvider.user.uid)
        myRole = args.oldRole;

      if (myRole != PhasedProvider.ROLE_ID.ADMIN && myRole != PhasedProvider.ROLE_ID.OWNER) {
        fail('PERMISSION_DENIED', 'You are not authorized to change another user\'s role on this team.');
        return;
      }

      // 2. validate new auth
      if (!(args.newRole in PhasedProvider.ROLE)) {
        fail('INVALID_ROLE', 'Invalid role data');
        return;
      }

      // 3. ensure member is on team
      if (!(args.memberID in PhasedProvider.team.members)) {
        fail('INVALID_USER', 'Cannot change role for member not on team');
        return;
      }

      // 4. update DB (which will update UI);
      FBRef.child('team/' + PhasedProvider.team.uid + '/members/' + args.memberID + '/role').set(args.newRole, function(err){
        if (err) {
          var strings = err.message.split(': ');
          fail(strings[0], 'Server says: "' + strings[1] + '"');
        } else {
          ga('send', 'event', 'Member', 'Role changed');
          issueNotification({
            title : [{string : 'Role for '}, {userID : args.memberID}, {string: ' has changed'}],
            body : [{string : 'to ' + PhasedProvider.ROLE[args.newRole]}],
            type : PhasedProvider.NOTIF_TYPE_ID.USER_ROLE_CHANGED
          });
        }
      });
    }

    /**
    *
    * marks a single notification as read
    * without deleting it from the server
    *
    */
    var _markNotifAsRead = function(key, index) {
      var args = {
        key : key,
        index : index
      }
      registerAsync(doMarkNotifAsRead, args);
    }

    var doMarkNotifAsRead = function(args) {
      var key = args.key;
      var index = args.index;

      // find index if not there
      if (typeof index == 'undefined') {
        for (var i in PhasedProvider.notif.stream) {
          if (PhasedProvider.notif.stream[i].key == key) {
            index = i;
            break;
          }
        }
      }

      PhasedProvider.notif.stream[index].read = true;
      FBRef.child('notif/' + PhasedProvider.team.uid + '/' + _Auth.user.uid + '/' + key).update({
        read : true
      });
      ga('send', 'event', 'Notification', 'Read');
    }

    /**
    *
    * marks all notifications as read
    * without deleting them from the server
    *
    */
    var _markAllNotifsAsRead = function() {
      registerAsync(doMarkAllNotifsAsRead);
    }

    var doMarkAllNotifsAsRead = function() {
      for (var i in PhasedProvider.notif.stream) {
        doMarkNotifAsRead({
          key : PhasedProvider.notif.stream[i].key,
          index : i
        });
      }
    }

    /**
    *
    * add category to current team
    *
    * NB: This will update categories of the same name or key
    *
    * 1. check all incoming category properties
    * 2. check if category with that name or key already exists
    * 3A. if so, update it
    * 3B. if not, create it
    *
    */
    var _addCategory = function(category) {
      registerAsync(doAddCategory, category);
    }

    var doAddCategory = function(args) {
      var category = {
        name :  args.name,
        color : args.color
      };

      // 1.
      // check colour
      var regex = /^\#([a-zA-Z0-9]{3}|[a-zA-Z0-9]{6})$/;
      if (!(category.color && regex.test(category.color))) {
        console.log('bad category colour');
        return;
      }

      // check name exists, has length, is a word
      regex = /\w+/;
      if (!(category.name && regex.test(category.name))) {
        console.log('bad category name');
        return;
      }

      category.created = new Date().getTime();
      category.user = _Auth.user.uid;

      console.log('creating category', category);

      // 2. Check if category exists
      var catExists = false;
      var key = '';
      for (key in PhasedProvider.team.categoryObj) {
        var nameExists = PhasedProvider.team.categoryObj[key].name.toLowerCase() == category.name.toLowerCase();
        var keyExists = key == args.key;
        if (nameExists || keyExists) {
          catExists = true;
          break;
        }
      }

      // 3A. category exists; update
      if (catExists) {
        console.log('cat exists at ' + key);
        FBRef.child('team/' + PhasedProvider.team.uid + '/category/' + key).set(category);
        ga('send', 'event', 'Category', 'Changed');
        issueNotification({
          title : [{string : '"' + category.name + '" category has been modified'}],
          body : [],
          cat : key,
          type : PhasedProvider.NOTIF_TYPE_ID.CATEGORY_CHANGED
        });
      }

      // 3B.
      else {
        console.log('cat doesn\'t exist');
        var newCatRef = FBRef.child('team/' + PhasedProvider.team.uid + '/category').push(category);
        ga('send', 'event', 'Category', 'Created');
        issueNotification({
          title : [{string : '"' + category.name + '" category has been created'}],
          body : [],
          cat : newCatRef.key(),
          type : PhasedProvider.NOTIF_TYPE_ID.CATEGORY_ADDED
        });
      }
    }

    /**
    *
    * deletes category from current team
    *
    * NB: will attempt to delete a cat even if not there
    *
    * 1. ensure key is a string
    * 2. delete category
    */
    var _deleteCategory = function(key) {
      registerAsync(doDeleteCategory, key);
    }

    var doDeleteCategory = function(key) {
      // 1.
      if ((typeof key).toLowerCase() != 'string') {
        console.log('bad key');
        return;
      }

      var catName = PhasedProvider.team.categoryObj[key].name; // stash cat name
      console.log('deleting cat ' + catName);

      // 2.
      FBRef.child('team/' + PhasedProvider.team.uid + '/category/' + key).set(null);
      ga('send', 'event', 'Category', 'Deleted');

      // 3.
      issueNotification({
        title : [{string : '"' + catName + '" category has been deleted'}],
        body : [],
        type : PhasedProvider.NOTIF_TYPE_ID.CATEGORY_DELETED
      });
    }


    /**
    *
    *	bounces user to / if they aren't admin or owner
    *
    *	an agressive function. Will try to bounce user as soon as
    *	it knows what role the user is.
    */

    var _maybeBounceUser = function() {
    	// try to do immediately if user's role is set
    	if (!!PhasedProvider.team.members[PhasedProvider.user.uid] &&
    		typeof PhasedProvider.team.members[PhasedProvider.user.uid].role !== 'undefined')
    		doMaybeBounceUser();

    	// also schedule for when data comes in
    	registerAsync(doMaybeBounceUser);

    	// also do whenever user's role may have changed
    	$rootScope.$on('Phased:memberChanged', doMaybeBounceUser);
    }

    var doMaybeBounceUser = function() {
    	var myRole = PhasedProvider.team.members[_Auth.user.uid].role;
    	if (myRole != PhasedProvider.ROLE_ID.ADMIN && myRole != PhasedProvider.ROLE_ID.OWNER)
    		$location.path('/');
    }

    /**
    *
    *	bounces a user to the respective route depending on their
    *	team's pay status
    *
    */
    var _maybeBounceTeam = function() {
    	if (
	    		BOUNCE_ROUTES && // we're using bounce routes
	    		PhasedProvider.viewType in BOUNCE_ROUTES && // the view type requires a bounce route
	    		$location.path() != BOUNCE_ROUTES[PhasedProvider.viewType] // we're not already at that route
    		)
    		$location.path(BOUNCE_ROUTES[PhasedProvider.viewType]);
    }


    /**

      Data functions
      Things like adding statuses, assignments, projects, etc.

    **/

    /**
    *
    * sends a status update to the server, pushes to team
    * these are the normal status updates used in /feed
    *
    * cleans newStatus first. fails if bad data.
    *
    */

    var _addStatus = function(newStatus) {

      registerAsync(doAddStatus, newStatus);
    }

    var doAddStatus = function(newStatus) {
      ga('send', 'event', 'Update', 'Submitted');
      ga('send', 'event', 'Status', 'Status added');

      // clean

      newStatus.user = _Auth.user.uid;

      newStatus = cleanStatus(newStatus);

      if (!newStatus) return;

      newStatus.time = new Date().getTime();

      // publish to stream
      var teamRef = FBRef.child('team/' + PhasedProvider.team.uid);

      teamRef.child('members/' + PhasedProvider.user.uid + '/currentStatus').set(newStatus); // REMOVE AFTER APRIL 22 2016

      var newStatusRef = teamRef.child('statuses').push(newStatus, function(err){
        // after DB is updated, issue a notification to all users

        if (!err) {
          issueNotification({
            title : [{ userID : _Auth.user.uid }],
            body : [{ string : newStatus.name }],
            cat : newStatus.cat,
            type : PhasedProvider.NOTIF_TYPE_ID.STATUS
          });
        }
      });
      var statuesID = newStatusRef.key();
      teamRef.child('members/' + PhasedProvider.user.uid ).child('currentStatusID').set(statuesID);
      // if the status had a task attached to it then submit the status id to the task
      if (newStatus.task) {
        var postID = newStatusRef.key();
        teamRef.child('projects/' + newStatus.task.project +'/columns/'+newStatus.task.column +'/cards/'+ newStatus.task.card +'/tasks/'+newStatus.task.id+'/statuses').push(postID);
      }

      //Send status to server for URL parsing.
      var postID = newStatusRef.key();
      $http.post('./api/things', {text: newStatus.name,id:postID})
        .then(function(res) {
        	var data = res.data;
          var statusRef = newStatusRef.key();
          console.log(data);
          if(data.url){
            mixpanel.track("URL in status");
            var teamRef = FBRef.child('team/' + PhasedProvider.team.uid);
            teamRef.child('statuses').child(statusRef).child('attachment').set(data);
          }
        });
    }


    /**
    *
    * adds a task
    * 1. check & format input
    * 2. push to db (using default project / card if none specified)
    * 3. update history to created
    *
    */
    var _addTask = function(newTask, projectID, columnID, cardID) {
      var args = {
        newTask : newTask,
        projectID : projectID,
        columnID : columnID,
        cardID : cardID
      }
      registerAsync(doAddTask, args);
    }

    var doAddTask = function(args) {
      ga('send', 'event', 'Task', 'task added');

      var newTask = args.newTask,
        projectID = args.projectID || DEFAULTS.projectID,
        columnID = args.columnID || DEFAULTS.columnID,
        cardID = args.cardID || DEFAULTS.cardID;

      // 1. clean newTask
      newTask.assigned_by = _Auth.user.uid; // this changes if the task is re-assigned
      newTask.created_by = _Auth.user.uid; // this never changes
      newTask = cleanAssignment(newTask);
      if (!newTask) return; // makeTask failed

      newTask.time = new Date().getTime();

      // 2. push to db
      var newTaskRef = FBRef.child('team/' + PhasedProvider.team.uid + '/projects/' + projectID + '/columns/' + columnID + '/cards/' + cardID + '/tasks')
        .push(newTask);

      // 3. update history
      updateTaskHist({taskRef : newTaskRef, type : PhasedProvider.task.HISTORY_ID.CREATED, task : newTask }); // update new task's history
    }

    /**
    *
    * a user starts working on a task
    *
    * 1. take the task if it's not already assigned to you
    * 2. set the task status to In Progress
    * 3. add it as a status update
    *
    */
    var _activateTask = function (taskID, task, prefix) {
      var args = {
        task : task,
        prefix: prefix,
        taskID : taskID
      }
      registerAsync(doActivateTask, args);
    }

    var doActivateTask = function(args) {
      var task = angular.copy( args.task ),
        taskID = args.taskID,
        prefix = args.prefix;

      task.task = {
          project : '0A',
          column : '0A',
          card : '0A',
          id : taskID,
          name : task.name
        }
      // update time to now and place to here (feature pending)
      task.time = new Date().getTime();

      // take the task if it's not already ours
      if (task.assigned_to != PhasedProvider.user.uid)
        _takeTask(taskID);

      // update original assignment status to In Progress
      _setTaskStatus(taskID, PhasedProvider.task.STATUS_ID.IN_PROGRESS);

      // publish to stream
      task.name = prefix + task.name;
      _addStatus(task);

      ga('send', 'event', 'Update', 'submitted');
      ga('send', 'event', 'Task', 'activated');
    }

    /*
    *
    * A user completes a task
    *
    * 1. set task status to complete
    * 2. update own status
    *
    */
    var _completeTask = function(taskID, task, prefix) {
      var args = {
        task : task,
        prefix: prefix,
        taskID : taskID
      }
      registerAsync(doCompleteTask, args);
    }

    var doCompleteTask = function(args) {
      var task = angular.copy( args.task ),
        taskID = args.taskID,
        prefix = args.prefix || '';

      _setTaskStatus(taskID, PhasedProvider.task.STATUS_ID.COMPLETE);
      task.name = prefix + task.name;
      _addStatus(task);

      ga('send', 'event', 'Update', 'submitted');
      ga('send', 'event', 'Task', 'completed');
    }

    /**
    *
    * sets an assignment's status
    * fails if newStatus isn't valid
    */
    var _setTaskStatus = function(taskID, newStatus) {
      var args = {
        taskID : taskID,
        newStatus : newStatus
      }
      registerAsync(doSetTaskStatus, args);
    }

    var doSetTaskStatus = function(args) {
      var taskID = args.taskID,
        newStatus = args.newStatus;
      if (!(newStatus in PhasedProvider.task.STATUS)) { // not a valid ID, might be a valid string
        var i = PhasedProvider.task.STATUS.indexOf(newStatus); // get index of possible string
        if (i !== -1) { // found it
          console.log(newStatus + ' is a valid status name');
          newStatus = i; // set newStatus to be status ID, not name
        } else { // didn't find it
          console.log('err: ' + newStatus + ' is not a valid status name or ID');
          return;
        }
      }
      ga('send', 'event', 'Task', 'task status update: ' + PhasedProvider.task.STATUS[newStatus]);

      // push to database
      var update = {status : newStatus};
      // add completeTime to task if it's been completed
      // (we could probably also just check against the history snapshot and time)
      if (newStatus == PhasedProvider.task.STATUS_ID.COMPLETE)
        update.completeTime = new Date().getTime();
        //update.name = prefix + update.name;
        //_addStatus(update);

      var taskRef = FBRef.child(find(taskID, 'task').FBAddr);
      taskRef.update(update);
      updateTaskHist({
        taskRef: taskRef,
        taskID : taskID,
        type: PhasedProvider.task.HISTORY_ID.STATUS
      });
    }

    /**
    *
    * edit task assignee
    *
    * sets assigned_to, assigned_by (to self), and status to ASSIGNED
    */
    var _setTaskAssignee = function(taskID, newAssignee) {
      var args = {
        taskID : taskID,
        newAssignee : newAssignee
      }
      registerAsync(doSetTaskAssignee, args);
    }

    var doSetTaskAssignee = function(args) {
      FBRef.child(find(args.taskID, 'task').FBAddr)
        .update({
          assigned_to : args.newAssignee,
          assigned_by : PhasedProvider.user.uid,
          status : PhasedProvider.task.STATUS_ID.ASSIGNED,
          unassigned : null
        }, function(err) {
          if (!err) {
            ga('send', 'event', 'Task', 'Assigned');
            updateTaskHist({
              taskID : args.taskID,
              type : PhasedProvider.task.HISTORY_ID.ASSIGNEE
            });
          }
        });
    }

    /**
    *
    * shorthand for self-assigning a task
    *
    */
    var _takeTask = function(taskID) {
      _setTaskAssignee(taskID, PhasedProvider.user.uid);
    }


    /**
    *
    * edit task name
    * (simple FB interaction)
    *
    */
    var _setTaskName = function(taskID, newName) {
      var args = {
        taskID : taskID,
        newName : newName || ''
      }
      registerAsync(doSetTaskName, args);
    }

    var doSetTaskName = function(args) {
      FBRef.child(find(args.taskID, 'task').FBAddr)
        .update({ name : args.newName }, function(err){
        if (!err) {
          ga('send', 'event', 'Task', 'Name changed');
          updateTaskHist({
            taskID : args.taskID,
            type: PhasedProvider.task.HISTORY_ID.NAME
          });
        }
      });
    }

    /**
    *
    * edit task description
    * (simple FB interaction)
    *
    */
    var _setTaskDesc = function(taskID, newDesc) {
      var args = {
        taskID : taskID,
        newDesc : newDesc || ''
      }
      registerAsync(doSetTaskDesc, args);
    }

    var doSetTaskDesc = function(args) {
      FBRef.child(find(args.taskID, 'task').FBAddr)
        .update({'description' : args.newDesc}, function(err){
        if (!err) {
          ga('send', 'event', 'Task', 'Description changed');
          updateTaskHist({
            taskID : args.taskID,
            type : PhasedProvider.task.HISTORY_ID.DESCRIPTION
          });
        }
      });
    }

    /**
    *
    * edit task deadline
    * (simple FB interaction)
    *
    */
    var _setTaskDeadline = function(taskID, newDeadline) {
      var args = {
        taskID : taskID,
        newDeadline : newDeadline || ''
      }
      registerAsync(doSetTaskDeadline, args);
    }

    var doSetTaskDeadline = function(args) {
      // if newDate is set, get timestamp; else null
      var newDeadline = args.newDeadline ? new Date(args.newDeadline).getTime() : '';
      FBRef.child(find(args.taskID, 'task').FBAddr)
        .update({'deadline' : newDeadline }, function(err){
        if (!err) {
          ga('send', 'event', 'Task', 'Deadline changed');
          updateTaskHist({
            taskID : args.taskID,
            type : PhasedProvider.task.HISTORY_ID.DEADLINE
          });
        }
      });
    }

    /**
    *
    * edit task category
    * (simple FB interaction)
    *
    */
    var _setTaskCategory = function(taskID, newCategory) {
      var args = {
        taskID : taskID,
        newCategory : newCategory || ''
      }
      registerAsync(doSetTaskCategory, args);
    }

    var doSetTaskCategory = function(args) {
      FBRef.child(find(args.taskID, 'task').FBAddr)
        .update({'cat' : args.newCategory }, function(err){
        if (!err) {
          ga('send', 'event', 'Task', 'Category changed');
          updateTaskHist({
            taskID : args.taskID,
            type : PhasedProvider.task.HISTORY_ID.CATEGORY
          });
        }
      });
    }

    /**
    *
    * edit task priority
    * (simple FB interaction)
    *
    */
    var _setTaskPriority = function(taskID, newPriority) {
      var args = {
        taskID : taskID,
        newPriority : newPriority
      }
      registerAsync(doSetTaskPriority, args);
    }

    var doSetTaskPriority = function(args) {
      FBRef.child(find(args.taskID, 'task').FBAddr)
        .update({'priority' : args.newPriority }, function(err){
        if (!err) {
          ga('send', 'event', 'Task', 'Priority changed');
          updateTaskHist({
            taskID : args.taskID,
            type : PhasedProvider.task.HISTORY_ID.PRIORITY
          });
        }
      });
    }

    /**
    *
    *	gets n statuses for the team, starting at the time of the last status
    *	in memory. To be called when a new "page" of statuses needs to be
    *	loaded in (eg, at the bottom of a lazy-loaded list).
    *
    *	NB: oldest status age (timestamp) is updated whenever old statuses are
    *	loaded (page init and here).
    *
    *	NB: instead of debouncing this until after PHASED_STATUSES_SET_UP,
    *	it is simply not completed unless the call itself happens after statuses are in.
    *
    *	1. gets n of the team's statuses older than oldest status in memory
    *	2. joins with current statuses
    *
    *	args:
    *		n 	// number of statuses to load (defaults to STATUS_LIMIT)
    *
    */
    var _getStatusesPage = function(n) {
    	var args = {
    		n : n
    	}

    	if (PHASED_STATUSES_SET_UP) {
    		doGetStatusesPage(args);
    	}
    }

    var doGetStatusesPage = function(args) {
    	var n = args.n || STATUS_LIMIT;

    	// 1. get teams statuses since end time
    	FBRef.child('team/' + PhasedProvider.team.uid + '/statuses')
    	.orderByChild('time').endAt(oldestStatusTime).limitToLast(n)
    	.once('value', function(snap) {

        $rootScope.$evalAsync(function getStatusesPageCallback(){
      		var data = snap.val();
      		if (!data) return; // not an error if empty: we got all of the statuses requested (there were none)

      		// add to our list (no dupes possible)
      		_.assign(PhasedProvider.team.statuses, data);

      		// update oldest status time
      		for (var i in data) {
      			if (data[i].time < oldestStatusTime)
      				oldestStatusTime = data[i].time;
      		}
        });

    	});
    }

    /*
    **
    ** INTEGRATIONS
    **
    */

    /*
    *
    * GITHUB
    *
    */

    /**
    *
    *	Updates a user's GitHub user name (for the team)
    *	Assumes it will be the name at index = 0 if no index
    *
    */
    var _updateGHAlias = function(newUsername, index) {
    	var args = {
    		newUsername : newUsername,
    		index : index || 0
    	}
    	registerAsync(doUpdateGHAlias, args);
    }

    var doUpdateGHAlias = function(args) {
    	var newUsername = args.newUsername,
    		index = args.index;

    	FBRef.child('team/' + PhasedProvider.team.uid + '/members/' + PhasedProvider.user.uid + '/aliases/github/' + index).set(newUsername);
    }

    /**
    *
    *	Little wrapper for $http get
    * Returns a list of repos for the authenticated GH user;
    *	returns false if the user isn't authenticated
    *	returns HTTP error if error
    */
    var _getGHRepos = function(callback) {
    	callback = (typeof callback == 'function') ?
    		callback : function() {};
    	registerAsync(doGetGHRepos, callback);
    }

    var doGetGHRepos = function(callback) {
    	if (!('github' in _Auth.user)) {
    		console.warn('Cannot perform GitHub interaction for non-authenticated user.');
    		callback(false);
    		return;
    	}

  		$http.get('https://api.github.com/user/repos', {
  			params : {
  				access_token : _Auth.user.github.accessToken
  			}
  		}).then(
  			function success(res){
    			callback(res.data);
  			},
  			function error(res){
    			console.trace('Error with GH request', res);
    			callback(res);
  			}
  		);
    }


    /**
    *
    * GET /repos/:owner/:repo/hooks
    *
    * Returns a list of hooks for repos for the authenticated GH user;
    *	(optionally filters out hooks that don't relate to Phased)
    *	returns false if the user isn't authenticated
    *	returns HTTP error if error
    *
    *	expects repo to be of the same structure that GH returns
    *	OR that we store in our DB
    */

    var _getGHRepoHooks = function(repo, callback, onlyPhased) {
    	var args = {
    		repo : repo,
    		callback : (typeof callback == 'function') ? callback : function() {},
    		onlyPhased : onlyPhased
    	}
    	registerAsync(doGetGHRepoHooks, args);
    }

    var doGetGHRepoHooks = function(args) {
    	var repo = args.repo,
    		callback = args.callback,
    		onlyPhased = args.onlyPhased;

    	if (!('github' in _Auth.user)) {
    		console.warn('Cannot perform GitHub interaction for non-authenticated user.');
    		callback(false);
    		return;
    	}

  		var ghAPIEndpoint = repo.hooks_url || repo.apiUrl + '/hooks';
  		$http.get(ghAPIEndpoint, {
  			params : {
  				access_token : _Auth.user.github.accessToken
  			}
  		}).then(
  			function success(res) {
  				var hooks = res.data;
  				// rm all hooks with non-phased URL
  				if (onlyPhased)
						for (var i = 0; i < hooks.length; i++) {
							var hookUrl = hooks[i].config.url.toLowerCase();
							if (hookUrl.indexOf('phased') < 0 &&
								hookUrl.indexOf('ngrok') < 0 ) {
								hooks.splice(i, 1);
								i--; // to account for newly lost element
							}
						}
    			callback(hooks);
    		},
    		function error(res){
    			console.trace('Error with GH request', res);
    			callback(res);
    		}
    	);
    }


    /**
    *
    * wrapper for the above to add all hook data from the GH server
    *	for all of team's currently registered repos
    *
    *	we store the hook data in our own server but calling this ensures that the
    *	data is in synch with the effective data on GH.
    *
    */
    var _getAllGHRepoHooks = function(callback) {
    	callback = (typeof callback == 'function') ? callback : function() {};
    	registerAsync(doGetAllGHRepoHooks, callback);
    }

    var doGetAllGHRepoHooks = function(callback) {
    	if (!('github' in _Auth.user)) {
    		console.warn('Cannot perform GitHub interaction for non-authenticated user.');
        callback(false);
        return;
      }

    	for (var i in PhasedProvider.team.repos) {
    		(function(_i) {
    			doGetGHRepoHooks({
    				repo : PhasedProvider.team.repos[_i],
    				onlyPhased : true,
    				callback : function(hooks) {
    					var _callback = (i==_i) ? callback : function(){}; // use callback if this is the last one
    					FBRef.child('team/' + PhasedProvider.team.uid + '/repos/' + _i + '/hook').set(hooks[0], _callback);
	    			}
	    		});
    		})(i);
    	}
    }

    /**
    *
    *	Registers a webhook for a repo for a team
    *	allowing GitHub to push status updates to this team
    *	whenever a commit is made to the repo
    *
    *	1. post request to GH API to set webhook
    *	2. if successful, add repos key to team
    *
    *	returns success status (bool) to callback
    *
    */

    var _registerGHWebhookForRepo = function(repo, callback) {
    	var args = {
    		repo : repo,
    		callback : (typeof callback == 'function') ? callback : function(){}
    	}
    	registerAsync(doRegisterGHWebhookForRepo, args);
    }

    var doRegisterGHWebhookForRepo = function(args) {
    	var repo = args.repo,
    		callback = args.callback,
    		phasedAPIEndpoint = 'api/hooks/github/repo/' + PhasedProvider.team.uid;

    	if (!('github' in _Auth.user)) {
    		console.warn('Cannot perform GitHub interaction for non-authenticated user.');
    		callback(false);
    		return;
    	}

    	// live/dev switch
    	if (WEBHOOKS_LIVE.GITHUB)
    		phasedAPIEndpoint = WEBHOOK_HOSTNAME.LIVE + phasedAPIEndpoint;
    	else
    		phasedAPIEndpoint = WEBHOOK_HOSTNAME.DEV + phasedAPIEndpoint;

    	// 0. if repo already registered, disallow re-registering
    	if (PhasedProvider.team.repos && PhasedProvider.team.repos[repo.id]) {
    		console.warn('Hook for GitHub repository ' + repo.name + '  already registered, will not re-register');
    		callback(false);
    		return;
    	}

    	// 1.
  		$http.post(repo.hooks_url, {
				name : 'web',
				events : ['push'],
				active : true,
				config : {
					url : phasedAPIEndpoint,
					content_type : 'json', // either 'json' or 'form'
					secret : '81c4e9c6e9fa5a7b77ba19d94f99f4b9974e58ae',
					insecure_ssl : !WEBHOOKS_LIVE.GITHUB // only while in dev
				}
  		}, {
				headers : {
					"Authorization" : "token " + _Auth.user.github.accessToken
				}
  		}).then(
  			function success(res) {
  				if (res.status != 201) {
  					doDeleteWebhook(res.data, repo.id); // res.data is the new hook
  					callback(false);
  					return;
  				}

  				// posted to github okay, but still need to to FB transaction
  				// so that our server knows its okay to accept data from GH
    			FBRef.child('team/' + PhasedProvider.team.uid + '/repos/' + repo.id).set({
    				id : repo.id,
    				name : repo.name,
    				fullName : repo.full_name,
    				owner : {
    					name : repo.owner.name || repo.owner.login // name if individual or login for org
    				},
    				url : repo.html_url,
    				apiUrl : repo.url,
    				acceptedHooks : ["push"],
    				hook : res.data
    			}, function(err){
    				if (err) {
    					console.log(err);
    					callback(false);
    				} else {
    					// add hook to repo in model
  						PhasedProvider.team.repos[repo.id].hook = res.data;
    					callback(true);
    				}
    			});
    		},
    		function error(res){
    			console.trace('Error with GH request', res);
    			callback(false);
    		}
  		);
    }

    /**
    *
    *	Toggles the active state for a webhook
    * PATCH /repos/:owner/:repo/hooks/:id
    *
    *	1. sends the request to GH
    *	2. updates the local (client) data for the hook
    *	3. callback
    *
    */
    var _toggleGHWebhookActive = function(hook, repoID, callback, active) {
    	var args = {
    		hook : hook,
    		repoID : repoID,
    		callback : (typeof callback == 'function') ? callback : function() {},
    		active : active
    	}
    	registerAsync(doToggleGHWebhookActive, args);
    }

    var doToggleGHWebhookActive = function(args) {
    	var hook = args.hook,
    		callback = args.callback,
    		repoID = args.repoID,
    		// use the supplied state or the opposite of the current state
    		active = (typeof args.active == 'boolean') ? args.active : !hook.active;

    	if (!('github' in _Auth.user)) {
    		console.warn('Cannot perform GitHub interaction for non-authenticated user.');
    		callback(false);
    		return;
    	}

    	// 1. send PATCH request to github
    	$http.patch(hook.url, {
				active : active,
  		}, {
				headers : {
					"Authorization" : "token " + _Auth.user.github.accessToken
				}
  		}).then(function(res){
  			if (!res.status == 200) {
  				callback(false);
  				return;
  			};
  			var updatedHook = res.data;

  			// 2. update hook in team
  			for (var i in PhasedProvider.team.repos) {
  				var thisRepo = PhasedProvider.team.repos[i];
  				if (thisRepo.id == repoID) {
						PhasedProvider.team.repos[i].hook = updatedHook;

						// 3. callback
						callback(updatedHook);
						return;
  				}
  			}
  		}, function(err) {
  			// if there are too many hooks registered to the repo,
  			// the GH response goes here (response is 422: Unprocessable Entity)
  			console.log(err);
  			callback(false);
  		});
    }

    /**
    *
    *	Deletes a webhook
    * DELETE /repos/:owner/:repo/hooks/:id
    *
    *	1. sends the request to GH
    *	2. deletes the repo on FB
    *
    *	no callback, GH doesn't send a response
    *
    */
    var _deleteGHWebhook = function(hook, repoID) {
    	var args = {
    		hook : hook,
    		repoID : repoID
    	}
    	registerAsync(doDeleteGHWebhook, args);
    }

    var doDeleteGHWebhook = function(args) {
    	var hook = args.hook,
    		repoID = args.repoID;

    	if (!('github' in _Auth.user))
    		return console.warn('Cannot perform GitHub interaction for non-authenticated user.');

    	// 1. send PATCH request to github
    	$http.delete(hook.url, {
				headers : {
					"Authorization" : "token " + _Auth.user.github.accessToken
				}
  		});

			// 2. delete repo from FB
			FBRef.child('team/' + PhasedProvider.team.uid + '/repos/' + repoID).set(null);
    }

    /*
    *
    *	GOOGLE
    *
    */

    /**
    *
    *	Asks the server if the current user is authenticated to use
    *	the Google apis.
    *
    *	Can be called immediately.
    *
    */
    var _checkGoogleAuth = function(callback) {
    	var callback = (typeof callback == 'function') ? callback : function(){};
    	registerAsync(doCheckGoogleAuth, callback);
    }

    var doCheckGoogleAuth = function(callback) {
    	$http.get('/api/google/hasAuth', {
    		headers : {
    			Authorization : 'Bearer ' + _Auth.user.token
    		}
    	}).then(function(res) {
    		PhasedProvider.user.googleAuth = res.data;
    		callback(res.data);
    	}, function(err) {
    		console.log(err);
    	});
    }

    /**
    *
    *	passes a list of calendars to the callback
    *	gets calendars from our server (which gets from google)
    *
    */
    var _getGoogleCalendars = function(callback) {
    	var callback = (typeof callback == 'function') ? callback : function(){};
    	registerAsync(doGetGoogleCalendars, callback);
    }

    var doGetGoogleCalendars = function(callback) {
    	$http.get('/api/google/cal', {
    		headers : {
    			Authorization : 'Bearer ' + _Auth.user.token
    		}
    	}).then(function(res) {
	    		callback(res.data);
	    	}, function(err) {
	    		callback([]);
	    		console.log(err);
	    	});
    }

    /**
    *
    *	registers a calendar for future status updates
    *
    *	Simply saves the calendar ID to the DB and the server does the rest
    *
    */
    var _registerGoogleCalendar = function(cal) {
    	registerAsync(doRegisterGoogleCalendar, cal);
    }

    var doRegisterGoogleCalendar = function(cal) {
    	// don't allow double registrations
    	if (cal.id in PhasedProvider.user.registeredCalendars)
    		return;

    	// add to FireBase
    	FBRef.child('integrations/google/calendars/' + PhasedProvider.user.uid + '/' + PhasedProvider.team.uid).push({
    		id : cal.id,
    		name : cal.summary
    	});
    }

    /**
    *
    *	deregisters a calendar
    *
    *	Simply removes the calendar ID from the DB
    *	HASN'T BEEN TESTED
    *
    */
    var _deregisterGoogleCalendar = function(cal) {
    	registerAsync(doDeregisterGoogleCalendar, cal);
    }

    var doDeregisterGoogleCalendar = function(cal) {
    	// removal from FireBase requires a 2x round trip
    	// because for some entirely frustrating reason
    	// one can neither remove via a query NOR a .ref().
    	var calsAddr = 'integrations/google/calendars/' + PhasedProvider.user.uid + '/' + PhasedProvider.team.uid;
			FBRef.child(calsAddr).orderByChild('id').equalTo(cal.id).once('value', function(snap) {
				var key = Object.keys(snap.val())[0];
  			FBRef.child(calsAddr + '/' + key).remove();
  		});
    }

  })
  .config(['PhasedProvider', 'FURL', 'AuthProvider', function(PhasedProvider, FURL, AuthProvider) {
    PhasedProvider.setFBRef(FURL);
    PhasedProvider.setWatchProjects(true);
    PhasedProvider.setWatchNotifications(true);
    PhasedProvider.setWatchPresence(true);
    PhasedProvider.setWatchIntegrations(true);

    // pass an object so that
    // BOUNCE_ROUTES[viewType] == '/routeForThatView'
    // eg,
    // BOUNCE_ROUTES['problem'] == '/team-expired'
    PhasedProvider.setBounceRoutes({
    	problem : '/team-expired',
    	canceled : '/switchteam'
    });

    // configure phasedProvider as a callback to AuthProvider
    AuthProvider.setDoAfterAuth(PhasedProvider.init);
  }]);
