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
        Because of this, all methods exposed by PhasedProvider must be registered with registerAsync.

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


    **/

    /**
    * Internal vars
    */
    var DEFAULTS = {
      // these all need to be strings
      projectID : '0A',
      columnID : '0A',
      cardID : '0A',
      // DEFAULTS.team is used in addTeam when creating a team
      // it's important that the category etc keys be strings
      team : {
        statuses : {},
        projects : {
          '0A' : {
            name : 'Default project',
            description : 'This is the default project. It is hidden when it is the only project.',
            isDefault : true, // isDefault to avoid default keyword
            created : Firebase.ServerValue.TIMESTAMP,
            columns : {
              '0A' : {
                name : 'Default column',
                isDefault : true,
                cards: {
                  '0A' : {
                    name : 'Default card',
                    description : 'This is the default card. It is hidden when it is the only card.',
                    isDefault : true,
                    tasks : {}, // filled eventually
                    history : {
                      '0A' : {
                        time : Firebase.ServerValue.TIMESTAMP,
                        type : 0, // PhasedProvider.card.HISTORY_ID.CREATED
                        snapshot : {
                          name : 'Default card',
                          description : 'This is the default card. It is hidden when it is the only card.',
                          isDefault : true
                        }
                      }
                    }
                  }
                },
                history : {
                  '0A' : {
                    time : Firebase.ServerValue.TIMESTAMP,
                    type : 0, // PhasedProvider.column.HISTORY_ID.CREATED
                    snapshot : {
                      name : 'Default column',
                      isDefault : true
                    }
                  }
                }
              }
            },
            history : {
              '0A' : {
                time : Firebase.ServerValue.TIMESTAMP,
                type : 0, // PhasedProvider.project.HISTORY_ID.CREATED
                snapshot : {
                  name : 'Default project',
                  description : 'This is the default project. It is hidden when it is the only project.',
                  isDefault : true
                }
              }
            }
          }
        },
        members : {},
        billing : {
          email : '',
          name : '',
          stripeid : '',
          plan : 'basic'
        },
        category : {
          '0A' : {
            color: '#FFCC00',
            name : 'Communication'
          },
          '1B' : {
            color: '#5AC8FB',
            name : 'Planning'
          }
        }
      }
    }, 

      // FLAGS
      PHASED_SET_UP = false, // set to true after team is set up and other fb calls can be made
      PHASED_MEMBERS_SET_UP = false, // set to true after member data has all been loaded
      PHASED_META_SET_UP = false, // set to true after static meta values are loaded
      WATCH_PROJECTS = false, // set in setWatchProjects in config; tells init whether to do it
      WATCH_NOTIFICATIONS = false, // set in setWatchNotifications in config; whether to watch notifications
      WATCH_PRESENCE = false, // set in setWatchPresence in config; whether to update user's presence
      
      // ASYNC CALLBACKS
      req_callbacks = [], // filled with operations to complete when PHASED_SET_UP
      req_after_members = [], // filled with operations to complete after members are in
      req_after_meta = [], // filled with operations to complete after meta are in
      membersRetrieved = 0; // incremented with each member's profile gathered
    
    var _Auth, FBRef; // tacked on to PhasedProvider
    var ga = ga || function(){}; // in case ga isn't defined (as in chromeapp)
    var $rootScope = { $broadcast : function(a){} }; // set in $get, default for if PhasedProvider isn't injected into any scope. not available in .config();

    /**
    *
    * The provider itself (all hail)
    * returned by this.$get
    */
    var PhasedProvider = {
        FBRef : FBRef, // set in setFBRef()
        user : {}, // set in this.init() to Auth.user.profile
        team : { // set in initializeTeam()
          _FBHandlers : [], // filled with callbacks to deregister in unwatchTeam()
          members : {},
          statuses : [], // stream of team's status updates
          teamLength : 0 // members counted in setUpTeamMembers
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
      }
    }

    /**
    *
    * constructs the provider itself
    * exposes data, methods, and a FireBase reference
    *
    */
    this.$get = ['$rootScope', function(_rootScope) {
      $rootScope = _rootScope;
      // register functions listed after this in the script...
      // PhasedProvider.getArchiveFor = _getArchiveFor;
      // PhasedProvider.moveToFromArchive = _moveToFromArchive;
      // PhasedProvider.activateTask = _activateTask;
      // PhasedProvider.takeTask = _takeTask;
      // PhasedProvider.addAssignment = _addAssignment;
      PhasedProvider.addStatus = _addStatus;
      PhasedProvider.setAssignmentStatus = _setAssignmentStatus;
      PhasedProvider.addMember = _addMember;
      PhasedProvider.addTeam = _addTeam;
      PhasedProvider.switchTeam = _switchTeam;
      // PhasedProvider.watchMemberAssignments = _watchMemberAssignments;
      PhasedProvider.changeMemberRole = _changeMemberRole;
      PhasedProvider.addCategory = _addCategory;
      PhasedProvider.deleteCategory = _deleteCategory;
      PhasedProvider.editTaskName = _editTaskName;
      PhasedProvider.editTaskDesc = _editTaskDesc;
      PhasedProvider.editTaskDeadline = _editTaskDeadline;
      PhasedProvider.editTaskAssignee = _editTaskAssignee;
      PhasedProvider.editTaskCategory = _editTaskCategory;
      PhasedProvider.editTaskPriority = _editTaskPriority;
      PhasedProvider.markNotifAsRead = _markNotifAsRead;
      PhasedProvider.markAllNotifsAsRead = _markAllNotifsAsRead;

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
    * if Phased has team and member data, do the thing
    * otherwise, add it to the list of things to do
    *
    */
    var registerAsync = function(callback, args) {
      if (PHASED_SET_UP)
        callback(args);
      else
        req_callbacks.push({callback : callback, args : args });
    }

    var doAsync = function() {
      for (var i in req_callbacks) {
        req_callbacks[i].callback(req_callbacks[i].args || undefined);
      }
      PHASED_SET_UP = true;
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
        $rootScope.$broadcast('Phased:meta');
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
      FBRef.child('team/' + PhasedProvider.team.uid).once('value', function(snap) {
        var data = snap.val();

        PhasedProvider.team.name = data.name;
        PhasedProvider.team.members = data.members;
        PhasedProvider.team.teamLength = Object.keys(data.members).length;
        PhasedProvider.team.statuses = data.statuses;
        PhasedProvider.team.projects = data.projects;
        PhasedProvider.team.project_archive = data.project_archive;
        PhasedProvider.team.categoryObj = data.category;
        PhasedProvider.team.categorySelect = objToArray(data.category); // adds key prop

        // get profile details for team members
        for (var id in PhasedProvider.team.members) {
          initializeMember(id);
        }

        // monitor team for changes
        watchTeam();

        // get billing info
        checkPlanStatus(data.billing.stripeid);
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
        PhasedProvider.team.members[id] = PhasedProvider.team.members[id] || {};

        // 2. apply data
        PhasedProvider.team.members[id].name = data.name;
        PhasedProvider.team.members[id].pic = data.gravatar;
        PhasedProvider.team.members[id].gravatar = data.gravatar;
        PhasedProvider.team.members[id].email = data.email;
        PhasedProvider.team.members[id].tel = data.tel;
        PhasedProvider.team.members[id].uid = id;
        PhasedProvider.team.members[id].newUser = data.newUser;

        // 3. and then watch for changes
        var handler = FBRef.child('profile/' + id).on('child_changed', function(snap) {
          var data = snap.val(),
            key = snap.key(),
            currentUser = id == PhasedProvider.user.uid;

          // 3B. apply data to appropriate key
          PhasedProvider.team.members[id][key] = data;
          if (currentUser) // if this is for the current user
            PhasedProvider.user[key] = data

          // special duplicate case
          if (key == 'gravatar') {
            PhasedProvider.team.members[id].pic = data;
            if (currentUser)
              PhasedProvider.user.pic = data;
          }
        });

        // L1. stash handler to stop watching event if needed
        var deregister_obj = {
            address : 'profile/' + id,
            eventType : 'child_changed',
            callback : handler
          };

        ('_FBHandlers' in PhasedProvider.team.members[id] &&
          typeof PhasedProvider.team.members[id]._FBHandlers == 'object') ?
          PhasedProvider.team.members[id].push(deregister_obj) :
          PhasedProvider.team.members[id]._FBHandlers = [deregister_obj];

        // L2. broadcast events to tell the rest of the app the team is set up
        $rootScope.$broadcast('Phased:member');

        // L3. and L4. (once all members are in)
        membersRetrieved++;
        if (membersRetrieved == PhasedProvider.team.teamLength && !PHASED_MEMBERS_SET_UP) {
          $rootScope.$broadcast('Phased:membersComplete');
          $rootScope.$broadcast('Phased:setup');
          doAfterMembers();
          doAsync();
        }
      });
    }

    /**
    *
    * Checks current plan status
    *
    * Checks ./api/pays/find for the current team's viewType
    * defaults to 'notPaid'
    *
    **/
    var checkPlanStatus = function(stripeid) {
      if (stripeid) {
        $.post('./api/pays/find', {customer: stripeid})
          .success(function(data){
            if (data.err) {
              console.log(data.err);
              // handle error
            }
            if (data.status == "active"){
              //Show thing for active
              PhasedProvider.viewType = 'active';

            } else if (data.status == 'past_due' || data.status == 'unpaid'){
              //Show thing for problem with account
              PhasedProvider.viewType = 'problem';
            } else if (data.status == 'canceled'){
              //Show thing for problem with canceled
              PhasedProvider.viewType = 'notPaid';
            }
          })
          .error(function(data){
            console.log(data);
          });
      } else {
        PhasedProvider.viewType = 'notPaid';
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
        cb = ''; // set to callback for each FBRef.on()

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
      cb = FBRef.child(teamKey + '/statuses').on('child_added', function(snap){
        var key = snap.key();
        if (!(key in PhasedProvider.team.statuses))
          PhasedProvider.team.statuses[key] = snap.val();
      });

      PhasedProvider.team._FBHandlers.push({
        address : teamKey + '/statuses',
        eventType : 'child_added',
        callback : cb
      });


      // category (doesn't need memory references)
      cb = FBRef.child(teamKey + '/category').on('value', function(snap) {
        var data = snap.val();
        PhasedProvider.team.categoryObj = data;
        PhasedProvider.team.categorySelect = objToArray(data); // adds key prop
      });

      PhasedProvider.team._FBHandlers.push({
        address : teamKey + '/category',
        eventType : 'value',
        callback : cb
      });


      // billing
      cb = FBRef.child(teamKey + '/billing').on('value', function(snap){
        var billing = snap.val();
        checkPlanStatus(billing.stripeid);
      });

      PhasedProvider.team._FBHandlers.push({
        address : teamKey + '/billing',
        eventType : 'value',
        callback : cb
      });


      // members
      cb = FBRef.child(teamKey + '/members').on('child_changed', function(snap) {
        var memberID = snap.key(),
          data = snap.val();

        // if new member, initialize
        if (!(memberID in PhasedProvider.team.members)) {
          initializeMember(memberID);
        }

        // update all keys as needed
        for (var key in data) {
          PhasedProvider.team.members[memberID][key] = data;
        }
      });

      PhasedProvider.team._FBHandlers.push({
        address : teamKey + '/members',
        eventType : 'child_changed',
        callback : cb
      });

      // projects
      if (WATCH_PROJECTS)
        watchProjects();
    }

    /*
    *
    * unwatchTeam
    * prepares us to switch to another team by un-setting the active
    * firebase event handlers
    *
    */
    var unwatchTeam = function() {
      // unwatch all team watchers
      for (var i in PhasedProvider.team._FBHandlers) {
        var handler = PhasedProvider.team._FBHandlers[i];
        FBRef.child(handler.address).off(handler.eventType, handler.callback);
      }
      PhasedProvider.team._FBHandlers = [];

      // unwatch all team members
      for (var i in PhasedProvider.team.members) {
        var handlers = PhasedProvider.team.members[i]._FBHandlers;
        for (var j in handlers) {
          FBRef.child(handlers[j].address).off(handlers[j].eventType, handlers[j].callback);
        }
        PhasedProvider.team.members[i]._FBHandlers = [];
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
        $.post('./api/notification/clean', {
          user: PhasedProvider.user.uid,
          team : PhasedProvider.team.uid
        })
          .success(function(data) {
            if (data.success) {
              // console.log('clean notifications success', data);
            } else {
              console.log('clean notifications error', data);
            }
          })
          .error(function(data){
            console.log('err', data.error());
          });

        // set up watcher
        var notifAddress = 'notif/' + PhasedProvider.team.uid + '/' + PhasedProvider.user.uid;
        var cb = FBRef.child(notifAddress)
          .on('value', function(data) {
            var notifications = data.val();

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
    * 1. sets their presence to PhasedProvider.PRESENCE_ID.ONLINE now
    *
    * 2. sets their presence attr to PhasedProvider.PRESENCE_ID.OFFLINE 
    * and updates lastOnline on FB disconnect
    *
    */
    var watchPresence = function() {
      // 1. immediately
      FBRef.child('team/' + PhasedProvider.team.uid + '/members/' + PhasedProvider.user.uid).update({
        presence : PhasedProvider.PRESENCE_ID.ONLINE
      });

      // 2. on disconnect
      FBRef.child('team/' + PhasedProvider.team.uid + '/members/' + PhasedProvider.user.uid).onDisconnect().update({
        lastOnline : Firebase.ServerValue.TIMESTAMP,
        presence : PhasedProvider.PRESENCE_ID.OFFLINE
      });
    }


    /**
    *
    * Watches a team's projects after they've been loaded once
    *
    * Should only be called from watchTeam if WATCH_PROJECTS is set
    * Replaces watchAssignments()
    *
    * ~~STUB~~
    *
    */ 
    var watchProjects = function() {
      console.log('watchProjects');
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
    */
    var issueNotification = function(notification) {
      $.post('./api/notification/issue', {
        user: _Auth.user.uid,
        team : _Auth.currentTeam,
        notification : JSON.stringify(notification)
      })
        .success(function(data) {
            if (data.success) {
              // console.log('IssueNotif success', data);
            } else {
              console.log('IssueNotif error', data);
            }
        })
        .error(function(data){
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
      var streamItem = {};
      switch (data.type) {
        /**
        *   TASK CREATED
        */
        case PhasedProvider.TASK_HISTORY_CHANGES.CREATED :
          streamItem = {
            body : [{string : data.taskSnapshot.name}],
            cat : data.taskSnapshot.cat,
            type : PhasedProvider.notif.TYPE.ASSIGNMENT.CREATED
          };

          // make title :
          // 1 assigned to someone else
          // 2 self-assigned
          // 3 unassigned

          if (data.taskSnapshot.assigned_by != data.taskSnapshot.assignee && 
            (data.taskSnapshot.assignee && !data.taskSnapshot.unassigned)) { // 1
              streamItem.title = [
                { string : 'New task assigned to ' },
                { userID : data.taskSnapshot.assignee },
                { string : ' by ' },
                { userID : data.taskSnapshot.assigned_by }
              ];
          } else if (data.taskSnapshot.assigned_by == data.taskSnapshot.assignee) { // 2
            streamItem.title = [
              { userID : data.taskSnapshot.assigned_by },
              { string : ' self-assigned a new task' }
            ];
          } else if (data.taskSnapshot.unassigned) { // 3.
            streamItem.title = [
              { userID : data.taskSnapshot.assigned_by},
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
        case PhasedProvider.TASK_HISTORY_CHANGES.ARCHIVED :
          streamItem = {
            title : [{ string : 'Task archived' }],
            body : [{ string : data.taskSnapshot.name }],
            cat : data.taskSnapshot.cat,
            type : PhasedProvider.notif.TYPE.ASSIGNMENT.ARCHIVED
          }
          break;
        /**
        *   TASK UNARCHIVED
        */
        case PhasedProvider.TASK_HISTORY_CHANGES.UNARCHIVED :
          streamItem = {
            title : [{ string : 'Task unarchived' }],
            body : [{ string : data.taskSnapshot.name }],
            cat : data.taskSnapshot.cat,
            type : PhasedProvider.notif.TYPE.ASSIGNMENT.UNARCHIVED
          }
          break;
        /**
        *   TASK NAME CHANGED
        */
        case PhasedProvider.TASK_HISTORY_CHANGES.NAME :
          streamItem = {
            title : [{ string : 'Task name changed' }],
            body : [{ string : 'to "' + data.taskSnapshot.name + '"' }],
            cat : data.taskSnapshot.cat,
            type : PhasedProvider.notif.TYPE.ASSIGNMENT.UPDATED
          }
          break;
        /**
        *   TASK DESC CHANGED
        */
        case PhasedProvider.TASK_HISTORY_CHANGES.DESCRIPTION :
          streamItem = {
            title : [{ string : 'Task description changed' }],
            body : [{ string : data.taskSnapshot.name }],
            cat : data.taskSnapshot.cat,
            type : PhasedProvider.notif.TYPE.ASSIGNMENT.UPDATED
          }
          break;

        /**
        *   TASK ASSIGNEE CHANGED
        */
        case PhasedProvider.TASK_HISTORY_CHANGES.ASSIGNEE :
          streamItem = {
            title : [
              { string : 'Task assigned to '},
              { userID : data.taskSnapshot.assignee }
            ],
            body : [{ string : data.taskSnapshot.name }],
            cat : data.taskSnapshot.cat,
            type : PhasedProvider.notif.TYPE.ASSIGNMENT.ASSIGNED
          }
          break;
        /**
        *   TASK DEADLINE CHANGED
        */
        case PhasedProvider.TASK_HISTORY_CHANGES.DEADLINE :
          streamItem = {
            title : [{ string : 'Task deadline changed' }],
            body : [{ string : data.taskSnapshot.name }],
            cat : data.taskSnapshot.cat,
            type : PhasedProvider.notif.TYPE.ASSIGNMENT.UPDATED
          }
          break;
        /**
        *   TASK PRIORITY CHANGEd
        */
        case PhasedProvider.TASK_HISTORY_CHANGES.CATEGORY :
          streamItem = {
            title : [{ string : 'Task category changed' }],
            body : [{ string : data.taskSnapshot.name }],
            cat : data.taskSnapshot.cat,
            type : PhasedProvider.notif.TYPE.ASSIGNMENT.UPDATED
          }
          break;

        /**
        *   TASK PRIORITY CHANGED
        */
        case PhasedProvider.TASK_HISTORY_CHANGES.PRIORITY :
          streamItem = {
            title : [{ string : 'Task priority changed' }],
            body : [{ string : data.taskSnapshot.name }],
            cat : data.taskSnapshot.cat,
            type : PhasedProvider.notif.TYPE.ASSIGNMENT.UPDATED
          }
          break;

        /**
        *   TASK STATUS CHANGED
        */
        case PhasedProvider.TASK_HISTORY_CHANGES.STATUS :
          streamItem = {
            title : [{ string : 'Task status changed' }],
            body : [{ string : data.taskSnapshot.name }],
            cat : data.taskSnapshot.cat,
            type : PhasedProvider.notif.TYPE.ASSIGNMENT.STATUS
          }
          switch (data.taskSnapshot.status) {
            case PhasedProvider.TASK_STATUS_ID.IN_PROGRESS :
              streamItem.title = [{ string : 'Task in progress' }];
              break;
            case PhasedProvider.TASK_STATUS_ID.COMPLETE :
              streamItem.title = [{ string : 'Task completed' }];
              break;
            case PhasedProvider.TASK_STATUS_ID.ASSIGNED :
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
            body : [{ string : data.taskSnapshot.name }],
            cat : data.taskSnapshot.cat,
            type : PhasedProvider.notif.TYPE.ASSIGNMENT.UPDATED
          }
          break;
      }

      issueNotification(streamItem);
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
    * also issues a notification to the team
    *
    */

    var updateTaskHist = function(taskID, type) {
      var data = {
        time : new Date().getTime(),
        type : type
      }
      var location = ''; // set to appropriate of 'all' or 'archive/all'

      // set location and snapshot
      if (taskID in PhasedProvider.assignments.all) { // assignment is currently not archived
        data.taskSnapshot = angular.copy( PhasedProvider.assignments.all[taskID] );
        location = 'all';
      } else if (taskID in PhasedProvider.archive.all) {
        data.taskSnapshot = angular.copy( PhasedProvider.archive.all[taskID] );
        location = 'archive/all';
      } else {
        console.warn('Cannot update history (task ' + taskID + ' not currently in memory).');
        return;
      }

      delete data.taskSnapshot.history;

      // update history in DB
      FBRef.child('team/' + _Auth.currentTeam + '/assignments/' + location + '/' + taskID + '/history').push(data);

      // format and issue notification
      issueTaskHistoryNotification(data);   
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
          strings : ['cat', 'taskPrefix']
        }
      };

      return cleanObjectShallow(newStatus, config);
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
    * 2A. if so, adds to /team-invite-existing-member and registers current team on member's profile
    * 2B. if not, checks whether they are a profile in waiting
    * 2B1. if they are, add team to newMember's profile
    * 2B2. if not, add to /profile-in-waiting and /profile-in-waiting2
    */

    var _addMember = function(newMember) {
      var args = {
        newMember : newMember
      }

      registerAsync(doAddMember, args);
    }

    var doAddMember = function(args) {
      ga('send', 'event', 'Team', 'Member added');
      var invited = args.newMember;
      invited.email = invited.email.toLowerCase(); // Change text to lowercase regardless of user input.
      
      /**
        1. if user in /profile, simply add to team
        2. if user in /profile-in-waiting, add team to profile-in-waiting and wait for user to join
        3. if user in neither, create profile-in-waiting
      **/

      FBRef.child("profile").orderByChild("email").equalTo(invited.email).once('value',function(snap){
        var users = snap.val();

        if (users) {
          var userID = Object.keys(users)[0];
          // 1. add to team, send email
          var inviteData = {
            teams : { 0 : PhasedProvider.team.uid },
            email : invited.email,
            inviteEmail: PhasedProvider.user.email,
            inviteName: PhasedProvider.user.name
          }

          FBRef.child('profile/' + userID + '/teams').push(PhasedProvider.team.uid); // add to user's teams
          FBRef.child('team/' + PhasedProvider.team.uid + '/members/' + userID).update({role : PhasedProvider.ROLE_ID.MEMBER}); // add to this team
        } else {
          // 2. check if in profile-in-waiting
          FBRef.child("profile-in-waiting").orderByChild("email").equalTo(invited.email).once('value',function(snap){
            var users = snap.val();

            if (users) {
              var PIWID = Object.keys(users)[0];
              // already in PIW, add our team and wait for user
              FBRef.child('profile-in-waiting/' + PIWID + '/teams').push(PhasedProvider.team.uid);
            } else {
              // newly add to PIW
              var PIWData = {
                'teams' : { 0 : PhasedProvider.team.uid},
                'email' : invited.email,
                'inviteEmail': PhasedProvider.user.email,
                'inviteName': PhasedProvider.user.name
              };
              FBRef.child('profile-in-waiting').push(PIWData);
              FBRef.child('profile-in-waiting2').push(PIWData); // for Zapier
            }
          });
        }
      });
    }

    /**
    *
    * adds a team
    * function mostly copied from chromeapp ctrl-createTeam.js
    * 1. check if teamname is taken
    * 2A. if not:
    *  - create the team in /team
    *  - add to current user's profile
    *  - make it their current team
    *  - run success callback if it exists
    * 2B. if it does exist, run fail callback if it exists
    */

    var _addTeam = function(teamName, success, failure, addToExistingTeam) {
      var args = {
        teamName : teamName,
        success : success,
        failure : failure,
        addToExistingTeam : typeof addToExistingTeam === 'boolean' ? addToExistingTeam : false // only use value if set
      }
      registerAfterMeta(doAddTeam, args); // can be called before Phased team but needs Meta
    }

    var doAddTeam = function(args) {
      // get team with specified name
      FBRef.child('team').orderByChild('name').equalTo(args.teamName).once('value', function(snap) {
        var existingTeams = snap.val(),
          newTeamRef = '',
          newTeamKey = '',
          newRole = PhasedProvider.ROLE_ID.MEMBER;

        // if it doesn't exist, make it
        if (!existingTeams) {
          var newTeam = Object.assign({name : args.teamName}, DEFAULTS.team); // copies DEFAULTS.team, adding name node
          newTeamRef = FBRef.child('team').push(newTeam);
          newTeamKey = newTeamRef.key();
          newRole = PhasedProvider.ROLE_ID.OWNER; // if you make it, you own it
        } else if (existingTeams && !args.addToExistingTeam) { 
          // if it does exist and we're not supposed to add, call failure
          return args.failure(teamName);
        } else {
          newTeamKey = Object.keys(existingTeams)[0];
          newTeamRef = FBRef.child('team/' + newTeamKey);
        }

        // add to new team
        newTeamRef.child('members/' + _Auth.user.uid).update({
          role : newRole
        });

        // add to my list of teams if not already in it
        FBRef.child('profile/' + _Auth.user.uid + '/teams').orderByValue().equalTo(newTeamKey).once('value', function(snap){
          if (!snap.val()) {
            FBRef.child('profile/' + _Auth.user.uid + '/teams').push(newTeamKey);
          }
        });

        // switch to that team
        doSwitchTeam({
          teamID : newTeamKey,
          callback : args.success
        });
      });
    }


    /**
    *
    * switches current user's active team
    * optionally calls a callback
    */

    var _switchTeam = function(teamID, callback) {
      var args = {
        teamID : teamID,
        callback : callback
      }
      registerAsync(doSwitchTeam, args);
    }

    var doSwitchTeam = function(args) {
      // stash team
      var oldTeam = PhasedProvider.team.uid ? PhasedProvider.team.uid + '' : false;

      // remove old event handlers
      unwatchTeam();

      // reload team data
      PhasedProvider.team.uid = args.teamID;
      _Auth.currentTeam = args.teamID;
      initializeTeam();

      if (WATCH_NOTIFICATIONS)
        watchNotifications();

      // update user curTeam
      FBRef.child('profile/' + _Auth.user.uid + '/curTeam').set(args.teamID, function() {
        // execute callback if it exists
        if (typeof args.callback == 'function')
          args.callback();
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
    }

    /**
    *
    * changes a member's role
    * Server side API takes care of database interaction and sanitization
    * data passed = { 
    *    user : current user id, 
    *    assignee : id of user with new role
    *    role : new role
    *  }
    *
    */

    var _changeMemberRole = function(memberID, newRole, currentRole) {
      var args = {
        member : memberID,
        role : newRole,
        currentRole : currentRole
      }

      registerAsync(doChangeMemberRole, args);
    }

    var doChangeMemberRole = function(args) {
      // get user role from server
      $.post('./api/auth/role/set', {
        user: _Auth.user.uid,
        assignee : args.member,
        role : args.role
      })
        .success(function(data) {
            if (data.success) {
              // console.log('success', data);
            } else {
              // set back to old role if update fails
              PhasedProvider.team.members[args.member].role = args.currentRole;
              console.log('Auth error', data);
            }
        })
        .error(function(data){
          console.log('err', data.error());
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
      }

      // 3B.
      else {
        console.log('cat doesn\'t exist');
        FBRef.child('team/' + PhasedProvider.team.uid + '/category').push(category);
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
      console.log('deleting cat at ' + key);
      // 1.
      if ((typeof key).toLowerCase() != 'string') {
        console.log('bad key');
        return;
      }

      // 2. 
      FBRef.child('team/' + PhasedProvider.team.uid + '/category/' + key).set(null);
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
      teamRef.child('members/' + PhasedProvider.user.uid + '/currentStatus').set(newStatus);
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
    }


    /**
    *
    * adds a task
    * 1. check & format input
    * 2. push to db (using default project / card if none specified)
    *
    */
    var _addAssignment = function(newTask, projectID, columnID, cardID) {
      var args = {
        newTask : newTask,
        projectID : projectID,
        columnID : columnID,
        cardID : cardID
      }
      registerAsync(doAddAssignment, args);
    }

    var doAddAssignment = function(args) {
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

      // 2A

      var newTaskID = newTaskRef.key();
      // assignmentsRef.child('all/' + newTaskID + '/key').set(newTaskID); // set key on new task object
      // updateTaskHist(newTaskID, PhasedProvider.TASK_HISTORY_CHANGES.CREATED); // update new task's history
      
    }

    /**
    *
    * sets an assigned task to the user's active task
    * and sets status of that task to "In Progress" (0)
    *
    */
    var _activateTask = function (assignmentID) {
      registerAsync(doActivateTask, assignmentID);
    }

    var doActivateTask = function(assignmentID) {
      ga('send', 'event', 'Update', 'submitted');
      ga('send', 'event', 'Task', 'activated');

      // copy task so we don't damage the original assignment
      var task = angular.copy(PhasedProvider.assignments.all[assignmentID]);

      // update time to now and place to here (feature pending)
      task.time = new Date().getTime();
      // task.lat = $scope.lat ? $scope.lat : 0;
      // task.long = $scope.long ? $scope.long : 0;

      // in case of unassigned tasks, which don't have a user property
      task.user = PhasedProvider.user.uid;

      // update original assignment status to In Progress
      _setAssignmentStatus(assignmentID, PhasedProvider.TASK_STATUS_ID.IN_PROGRESS);

      // publish to stream
      var ref = FBRef.child('team/' + PhasedProvider.team.uid);
      ref.child('task/' + PhasedProvider.user.uid).set(task);
      ref.child('all/' + PhasedProvider.user.uid).push(task);
    }

    /**
    *
    * sets an assignment's status
    * fails if newStatus isn't valid
    */
    var _setAssignmentStatus = function(assignmentID, newStatus) {
      var args = {
        assignmentID : assignmentID,
        newStatus : newStatus
      }
      registerAsync(doSetAssignmentStatus, args);
    }

    var doSetAssignmentStatus = function(args) {
      var assignmentID = args.assignmentID,
        newStatus = args.newStatus;
      if (!(newStatus in PhasedProvider.TASK_STATUSES)) { // not a valid ID
        var i = PhasedProvider.TASK_STATUSES.indexOf(newStatus);
        if (i !== -1) {
          console.log(newStatus + ' is a valid status name');
          newStatus = i; // set newStatus to be status ID, not name
        } else {
          console.log('err: ' + newStatus + ' is not a valid status name or ID');
          return;
        }
      }
      ga('send', 'event', 'Task', 'task status update: ' + PhasedProvider.TASK_STATUSES[newStatus]);

      // push to database
      FBRef.child('team/' + PhasedProvider.team.uid + '/assignments/all/' + assignmentID + '/status').set(newStatus);
      updateTaskHist(assignmentID, PhasedProvider.TASK_HISTORY_CHANGES.STATUS);

      // if issue was complete, timestamp it
      if (newStatus == 1) {
        var time = new Date().getTime();
        FBRef.child('team/' + PhasedProvider.team.uid + '/assignments/all/' + assignmentID).update({"completeTime" : time});
      }
    }

    /**
    *
    * moves a task from /unassigned into /to/(me)
    * without touching status
    *
    */
    var _takeTask = function(assignmentID) {
      registerAsync(doTakeTask, assignmentID);
    }

    var doTakeTask = function(assignmentID) {
      ga('send', 'event', 'Task', 'task taken');
      var assignmentsPath = 'team/' + PhasedProvider.team.uid + '/assignments/';

      // 1. remove task from /unassigned
      delete assignmentIDs.unassigned[assignmentIDs.unassigned.indexOf(assignmentID)];
      FBRef.child(assignmentsPath + 'unassigned').set(assignmentIDs.unassigned);

      // 2. add task to /to/(me)
      assignmentIDs.to_me.push(assignmentID);
      FBRef.child(assignmentsPath + 'to/' + PhasedProvider.user.uid).set(assignmentIDs.to_me);

      // 3. set assignee attr
      FBRef.child(assignmentsPath + 'all/' + assignmentID + '/assignee').set(PhasedProvider.user.uid);

      updateTaskHist(assignmentID, PhasedProvider.TASK_HISTORY_CHANGES.ASSIGNEE);
    }

    /**
    *
    * edit task assignee
    *
    * 1. change lookup lists
      * A1. rm from old to lookup or unassigned
      * A2. add to new to lookup
      * B1. rm from old by lookup
      * B2. add to new by lookup
    * 2. update keys on task itself (assignee, user, assigned_by, status)
    *
    */ 
    var _editTaskAssignee = function(task, newAssignee) {
      var args = {
        task : task,
        newAssignee : newAssignee
      }
      registerAsync(doEditTaskAssignee, args);
    }

    var doEditTaskAssignee = function(args) {
      var assignmentsRef = 'team/' + _Auth.currentTeam + '/assignments';
      var task = args.task,
        taskID = task.key;
      var oldAssignee = task.assignee || false;
      var newAssignee = args.newAssignee;

      // 1. change lookup lists
      // A1. remove from assigned to lookup
      if (oldAssignee) {
        // get list
        FBRef.child(assignmentsRef + '/to/' + oldAssignee).once('value', function(data) {
          var list = data.val();
          list = popFromList(task.key, list)
          FBRef.child(assignmentsRef + '/to/' + oldAssignee).set(list);
        });
      } else { // remove from unassigned
        // we already have the list
        assignmentIDs['unassigned'] = popFromList(task.key, assignmentIDs['unassigned']);
        FBRef.child(assignmentsRef + '/unassigned').set(assignmentIDs['unassigned']);
      }

      // A2. add to new assigned to lookup
      FBRef.child(assignmentsRef + '/to/' + newAssignee).push(task.key);

      // B1. remove from assigned by lookup
      // get list
      FBRef.child(assignmentsRef + '/by/' + task.assigned_by).once('value', function(data) {
        var list = data.val();
        list = popFromList(task.key, list)
        FBRef.child(assignmentsRef + '/by/' + task.assigned_by).set(list);
      });

      // B2. add to new assigned to lookup
      FBRef.child(assignmentsRef + '/by/' + _Auth.user.uid).push(task.key);


      // 2. update assignment itself (this will clear task.key)
      FBRef.child(assignmentsRef + '/all/' + task.key).update({
        'assignee' : args.newAssignee,
        'user' : args.newAssignee,
        'assigned_by' : _Auth.user.uid,
        'status' : PhasedProvider.TASK_STATUS_ID.ASSIGNED,
        'unassigned' : false
      });
      updateTaskHist(taskID, PhasedProvider.TASK_HISTORY_CHANGES.ASSIGNEE);
    }

    /**
    *
    * edit task name
    * (simple FB interaction)
    *
    */ 
    var _editTaskName = function(taskID, newName) {
      var args = {
        taskID : taskID,
        newName : newName
      }
      registerAsync(doEditTaskName, args);
    }

    var doEditTaskName = function(args) {
      FBRef.child("team/" + _Auth.currentTeam + '/assignments/all/' + args.taskID + "/name").set(args.newName, function(err){
        if (!err) updateTaskHist(args.taskID, PhasedProvider.TASK_HISTORY_CHANGES.NAME);
      });
    }

    /**
    *
    * edit task description
    * (simple FB interaction)
    *
    */ 
    var _editTaskDesc = function(taskID, newDesc) {
      var args = {
        taskID : taskID,
        newDesc : newDesc
      }
      registerAsync(doEditTaskDesc, args);
    }

    var doEditTaskDesc = function(args) {
      FBRef.child("team/" + _Auth.currentTeam + '/assignments/all/' + args.taskID).update({'desc' : args.newDesc}, function(err){
        if (!err) updateTaskHist(args.taskID, PhasedProvider.TASK_HISTORY_CHANGES.DESCRIPTION);
      });
    }

    /**
    *
    * edit task deadline
    * (simple FB interaction)
    *
    */ 
    var _editTaskDeadline = function(taskID, newDeadline) {
      var args = {
        taskID : taskID,
        newDeadline : newDeadline
      }
      registerAsync(doEditTaskDeadline, args);
    }

    var doEditTaskDeadline = function(args) {
      // if newDate is set, get timestamp; else null
      var newDeadline = args.newDeadline ? new Date(args.newDeadline).getTime() : '';
      FBRef.child("team/" + _Auth.currentTeam + '/assignments/all/' + args.taskID).update({'deadline' : newDeadline }, function(err){
        if (!err) updateTaskHist(args.taskID, PhasedProvider.TASK_HISTORY_CHANGES.DEADLINE);
      });
    }

    /**
    *
    * edit task category
    * (simple FB interaction)
    *
    */ 
    var _editTaskCategory = function(taskID, newCategory) {
      var args = {
        taskID : taskID,
        newCategory : newCategory
      }
      registerAsync(doEditTaskCategory, args);
    }

    var doEditTaskCategory = function(args) {
      FBRef.child("team/" + _Auth.currentTeam + '/assignments/all/' + args.taskID).update({'cat' : args.newCategory }, function(err){
        if (!err) updateTaskHist(args.taskID, PhasedProvider.TASK_HISTORY_CHANGES.CATEGORY);
      });
    }

    /**
    *
    * edit task priority
    * (simple FB interaction)
    *
    */ 
    var _editTaskPriority = function(taskID, newPriority) {
      var args = {
        taskID : taskID,
        newPriority : newPriority
      }
      registerAsync(doEditTaskPriority, args);
    }

    var doEditTaskPriority = function(args) {
      FBRef.child("team/" + _Auth.currentTeam + '/assignments/all/' + args.taskID).update({'priority' : args.newPriority }, function(err){
        if (!err) updateTaskHist(args.taskID, PhasedProvider.TASK_HISTORY_CHANGES.PRIORITY);
      });
    }


  })
  .config(['PhasedProvider', 'FURL', 'AuthProvider', function(PhasedProvider, FURL, AuthProvider) {
    PhasedProvider.setFBRef(FURL);
    PhasedProvider.setWatchProjects(true);
    PhasedProvider.setWatchNotifications(true);
    PhasedProvider.setWatchPresence(true);

    // configure phasedProvider as a callback to AuthProvider
    AuthProvider.setDoAfterAuth(PhasedProvider.init);
  }]);
