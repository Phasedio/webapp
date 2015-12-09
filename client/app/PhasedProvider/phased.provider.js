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

      Current functionality:
        - Tasks (in progress)

      Pending functionality:
        - Feed page

    **/

    /**
    * Internal vars
    */
    var PHASED_SET_UP = false, // set to true after team is set up and other fb calls can be made
      req_callbacks = [], // filled with operations to complete when PHASED_SET_UP
      assignmentIDs = {
        to_me : [],
        by_me : [],
        unassigned : []
      },
      archiveIDs = {
        to_me : [],
        by_me : [],
        unassigned : []
      };


    /**
    * External vars
    * (exposed by this.$get())
    */
    var _Auth,
      _viewType = 'notPaid',  // Phased.viewType
      _billingInfo, // Phased.billing
      _taskPriorities, // Phased.TASK_PRIORITIES
      _taskStatuses, // Phased.TASK_STATUSES
      _team = {}, // Phased.team
      _currentUser = '', // Phased.user
      FBRef = '', // Phased.FBRef
      _assignments = { // Phased.assignments
        all : {}, // all of the team's assignments
        to_me : {}, // assigned to me (reference to objects in all)
        by_me : {}, // assigned by me (reference to objects in all)
        unassigned : {} // unassigned (reference to objects in all)
      },
      _archive = {}; // Phased.archive

    /**
    *
    * configure the provider and begin requests
    * called in AuthProvider's doAfterAuth callback,
    * which must be set in a .config() block
    *
    */

    this.init = function(Auth) {
      _Auth = Auth;
      _currentUser = Auth.user;
      _team.name = Auth.currentTeam;

      checkPlanStatus();
      setUpTeamMembers();
      getCategories();
      getTaskPriorities();
      getTaskStatuses();

      // things that can only be done after async operations are finished
      doAsync();
    }

    /**
    *
    * constructs the provider itself
    * exposes data, methods, and a FireBase reference
    *
    */
    this.$get = function() {
      return {
        user : _currentUser,
        team : _team,
        viewType : _viewType,
        billing : _billingInfo,
        TASK_PRIORITIES : _taskPriorities,
        TASK_PRIORITY_ID : {
          HIGH : 0,
          MEDIUM : 1,
          LOW : 2
        },
        TASK_STATUSES : _taskStatuses,
        TASK_STATUS_ID : {
          IN_PROGRESS : 0,
          COMPLETE : 1,
          ASSIGNED : 2
        },
        FBRef : FBRef,
        watchAssignments : _watchAssignments,
        assignments : _assignments,
        getArchiveFor : _getArchiveFor,
        archive : _archive,
        moveToFromArchive : _moveToFromArchive,
        activateTask : _activateTask,
        takeTask : _takeTask,
        addTask : _addTask
      }
    };

    // must be called in config or everything breaks
    this.setFBRef = function(FURL) {
      FBRef = new Firebase(FURL);
    }

    /**
    *
    * registerAsync
    * if Phased is already set to go, do the thing
    * otherwise, add it to the list of things to do
    *
    */
    var registerAsync = function(callback, args) {
      if (PHASED_SET_UP)
        callback(args);
      else
        req_callbacks.push({callback : callback, args : args });
    }

    /**
    *
    * doAsync
    * executes all registered callbacks
    *
    */
    var doAsync = function() {
      for (var i in req_callbacks) {
        req_callbacks[i].callback(req_callbacks[i].args || undefined);
      }
      PHASED_SET_UP = true;
    }



    /**
    **
    **  METADATA GATHERING FUNCTIONS
    **  In which app constants are gathered from server
    **  as well as information about the current user and team
    **
    **/

    // 1. static data

    // gathers task Priorities, adds to _taskPriorities
    var getTaskPriorities = function() {
      FBRef.child('taskPriorities').once('value', function(tP /*taskPriorities*/ ) {
        tP = tP.val();
        // console.log('taskPriorities', tP);
        if (typeof tP !== 'undefined' && tP != null){
          // assign keys to obj, set to _taskPriorities
          for (var i in tP) {
            tP[i]['key'] = i;
          }
          _taskPriorities = tP;

        } else {
          // no status priorities exist, add defaults
          var obj = [
            { name : 'High' },
            { name : 'Medium' },
            { name : 'Low' }
          ];

          // save to db
          FBRef.child('taskPriorities').set(obj);
          // get data from db to ensure synchronicity
          FBRef.child('taskPriorities').once('value', function(tP /*taskPriorities*/ ) {
            tP = tP.val();
            // assign keys to obj and set to _taskPriorities
            for (var i in tP) {
              tP[i]['key'] = i;
            }
            _taskPriorities = tP;
          });
        }
      });
    }

    // gathers task Statuses, adds to _taskStatuses
    var getTaskStatuses = function() {
      FBRef.child('taskStatuses').once('value', function(tS /*taskStatuses*/ ) {
        tS = tS.val();
        // console.log('taskStatuses', tS);
        if (typeof tS !== 'undefined' && tS != null){
          // assign keys to obj, set obj to $scope
          for (var i in tS) {
            tS[i]['key'] = i;
          }
          _taskStatuses = tS;
          // console.log('_taskStatuses', _taskStatuses);
        } else {
          // no status types exist, add defaults
          var obj = [
            { name : 'In Progress' },
            { name : 'Complete' },
            { name : 'Assigned' }
          ];

           // save to db
          FBRef.child('taskStatuses').set(obj);
          // get data from db to ensure synchronicity
          FBRef.child('taskStatuses').once('value', function(tS /*taskStatuses*/ ) {
            tS = tS.val();
            // assign keys to obj and set to _taskStatuses
            for (var i in tS) {
              tS[i]['key'] = i;
            }
            _taskStatuses = tS;
            // console.log('_taskStatuses', _taskStatuses);
          });
        }
      });
    }


    // 2. dynamic data (logged in user & team)

    /**
    *
    * gather team data
    * 1. watches the team's tasks
    * 1.b  when a new task is posted, it refreshes the team membership
    *
    */
    var setUpTeamMembers = function() {
      // get members
      FBRef.child('team').child(_team.name).child('task').on('value', function(users) {
        users = users.val();
        _team.members = {};

        if (users) {
          for (var id in users) {
            // needs to be in function otherwise for loop screws up id
            (function(id, users) {
              FBRef.child('profile/' + id).once('value', function(data){
                data = data.val();
                if (!data) return;

                var style = false;
                if (users[id].photo){
                  style = "background:url("+users[id].photo+") no-repeat center center fixed; -webkit-background-size: cover;-moz-background-size: cover; -o-background-size: cover; background-size: cover";
                }
                var user = {
                  name : data.name,
                  pic : data.gravatar,
                  task : users[id].name,
                  time : users[id].time,
                  weather: users[id].weather,
                  city: users[id].city,
                  uid : id,
                  photo: style
                };

                _team.members[id] = user;
              });
            })(id, users);
          }
        }
      });
    }

    // gathers team categories data and adds to _team
    var getCategories = function() {
      var team = _Auth.currentTeam;
      FBRef.child('team').child(team).child('category').once('value', function(cat) {
        cat = cat.val();
        _team.categorySelect = [];

        if(typeof cat !== 'undefined' && cat != null){
          var keys = Object.keys(cat);
          _team.categoryObj = cat;
            for (var i = 0; i < keys.length; i++){
              var obj = {
                name : cat[keys[i]].name,
                color : cat[keys[i]].color,
                key : keys[i]
              }
              _team.categorySelect.push(obj);
            }
        } else {
          //they have no categories so add them
          var obj = [
            {
              name : 'Communication',
              color : '#ffcc00'
            },
            {
              name : 'Planning',
              color : '#5ac8fb'
            }
          ];
          FBRef.child('team/' + team + '/category').set(obj);
          FBRef.child('team/' + team + '/category').once('value', function(cat) {
            cat = cat.val();
            var keys = Object.keys(cat);
            _team.categoryObj = cat;
              for(var i = 0; i < keys.length; i++){
                var obj = {
                  name : cat[keys[i]].name,
                  color : cat[keys[i]].color,
                  key : keys[i]
                }
                _team.categorySelect.push(obj);
              }
          });
        }
      });
    }

    // checks current plan status
    // retrofitted from main.controller.js to avoid using $http
    // may need changing but polls backend ok.
    var checkPlanStatus = function() {
      FBRef.child('team').child(_Auth.currentTeam).once('value', function(data){
        var team = data.val();

        if (team.billing){
          _billingInfo = team.billing;

          $.post('./api/pays/find', {customer: team.billing.stripeid})
            .success(function(data){
              if (data.err) {
                console.log(data.err);
                // handle error
              }
              if (data.status == "active"){
                //Show thing for active
                _viewType = 'active';

              } else if (data.status == 'past_due' || data.status == 'unpaid'){
                //Show thing for problem with account
                _viewType = 'problem';
              } else if (data.status == 'canceled'){
                //Show thing for problem with canceled
                _viewType = 'notPaid';
              }
              console.log("viewType: " + _viewType);
            })
            .error(function(data){
              console.log(data);
            });
        } else {
          _viewType = 'notPaid';
        }
      });
    }

    /**
    **
    ** EXPOSED FUNCTIONS
    ** all registered as callbacks with registerAsync(),
    **
    **/

    /**
    *
    * sets up watchers for current users task assignments (to and by
    * and also unassigned tasks), filling Phased.assignments (as _assignments)
    * for use in a controller
    *
    *   - own assignments (to self or to others) assignments/to/(me)
    *   - assignments to me by others assignments/by/(me)
    *   - unassigned tasks assignments/un
    */
    var _watchAssignments = function() {
      registerAsync(doWatchAssignments);
    }

    var doWatchAssignments = function() {
      // callbacks

      /**
      *
      * updates _assignments.all
      *
      * instead of replacing the whole object, compares assignments and props, then updates
      * allowing for persistent references throughout the app
      *
      */
      var updateAllAssignments = function(data) {
        data = data.val();
        console.log('all: ', data);
        if (!data) {
          _assignments.all = {};
          return;
        }
        var all = _assignments.all;

        // 1. if assignment doesn't exist in all, add it, end of story
        // 2. else, check its properties and update those that are out of sync
        // (i is the assignment uid)
        for (var i in data) {
          if (!(i in all)) {
            // 1.
            all[i] = data[i];

          } else {
            // 2.
            // a. sync extant properties in all, delete those no longer in data
            // b. add new properties from data
            // (j is property name)

            for (var j in all[i]) {
              // a.
              if (j in data[i]) {
                all[i][j] = data[i][j];
              } else {
                delete all[i][j];
              }
            }

            for (var j in data[i]) {
              // b.
              if (!(j in all[i])) {
                all[i][j] = data[i][j];
              }
            }

          }
        } // for var i in data

        // if assignment isn't in data, delete it
        for (var i in all) {
          if (!(i in data)) {
            delete all[i];
          }
        }

        // sync all containers
        for (var i in assignmentIDs) {
          syncAssignments(i);
        }
      } // updateAllAssignments()


      /**
      *
      * de-indexes and stores the data (list of task IDs),
      * then calls syncAssignments
      *
      */

      var updateAssignmentGroup = function(data, groupName) {
        assignmentIDs[groupName] = objToArray(data);
        syncAssignments(groupName);
      }

      /**
      *
      * syncs assignments (in _assignments.all) listed in the UIDContainer to the assignmentContainer
      * used to maintain a running list of references in the container, eg, _assignments.by_me, that point to 
      * the right assignment objects in _assignments.all
      *
      */
      var syncAssignments = function(assignmentContainerName) {
        var assignmentContainer = {},
          UIDContainer = assignmentIDs[assignmentContainerName];

        for (var i in UIDContainer) {
          var assignmentID = UIDContainer[i];
          if (assignmentID in _assignments.all)
            assignmentContainer[assignmentID] = _assignments.all[assignmentID];
        }

        _assignments[assignmentContainerName] = assignmentContainer;
      }

      // set up watchers
      var refString = 'team/' + _team.name + '/assignments';

      FBRef.child(refString + '/all').on('value', updateAllAssignments);
    
      FBRef.child(refString + '/to/' + _currentUser.uid).on('value', function(data) {
        data = data.val();
        updateAssignmentGroup(data, 'to_me');
      });
    
      FBRef.child(refString + '/by/' + _currentUser.uid).on('value', function(data) {
        data = data.val();
        updateAssignmentGroup(data, 'by_me');
      });
    
      FBRef.child(refString + '/unassigned').on('value', function(data) {
        data = data.val();
        updateAssignmentGroup(data, 'unassigned');
      });
    }; // end doWatchAssignments()


    /**
    *
    * gets archived tasks at the requested address
    *
    * 1. checks that address is valid
    * 2. makes firebase calls that fill _archive.all and archiveIDs[address]
    * 3. calls syncArchive which fills out _archive[address]
    *
    * on demand, not watched
    * can get to_me, by_me, and unassigned
    */
    var _getArchiveFor = function(address) {
      registerAsync(doGetArchiveFor, address);
    }

    var doGetArchiveFor = function(address) {
      /**
      *
      * links up the archived tasks from the archiveContainerName to the appropriate $scope.archive address
      * (sim to syncAssignments())
      */
      var syncArchive = function(archiveContainerName) {
        if (!(archiveContainerName in archiveIDs)) return; // ensures valid address

        var archiveContainer = {},
          UIDContainer = archiveIDs[archiveContainerName];

        for (var i in UIDContainer) {
          var assignmentID = UIDContainer[i];
          if (assignmentID in _archive.all)
            archiveContainer[assignmentID] = _archive.all[assignmentID];
        }

        _archive[archiveContainerName] = archiveContainer;
      }

      var archivePath = 'team/' + _team.name + '/assignments/archive/',
        pathSuffix = '';

      // 1
      switch(address) {
        case 'to_me' :
          pathSuffix = 'to/' + _currentUser.uid;
          break;
        case 'by_me' :
          pathSuffix = 'by/' + _currentUser.uid;
          break;
        case 'unassigned' :
          pathSuffix = 'unassigned';
          break;
        default:
          return;
      }

      console.log('getArchiveFor ' + address);

      // 2
      // get archive/all
      FBRef.child(archivePath + 'all').once('value', function(data){
        _archive.all = data.val() || [];

        // if other call is complete
        if (archiveIDs[address])
          syncArchive(address); // 3
      });

      // get appropriate IDs
      FBRef.child(archivePath + pathSuffix).once('value', function(data){
        archiveIDs[address] = objToArray(data.val());

        // if other call is complete
        if ('all' in _archive)
          syncArchive(address); // 3
      });
    }

    /**
    *
    * moves a task to or from the archive
    *
    * 1.A remove from /to/(me) or /unassigned (& note which)
    * 1.B remove from /by
    * 1.C remove from /all
    *
    * 2.A add to archive/to/(me) or archive/unassigned
    *   depending on which it was removed from
    * 2.B add to archive/by
    * 2.C add to archive/all
    * 2.D add to $scope.archive.all and run sync, since archive isn't watched
    */
    var _moveToFromArchive = function(assignmentID, unarchive) {
      var args = {
        assignmentID : assignmentID,
        unarchive : unarchive
      }
      registerAsync(doMoveToFromArchive, args);
    }

    var doMoveToFromArchive = function(args) {
      var path = "team/" + _team.name + "/assignments/",
        to_me = false,
        idsContainer = assignmentIDs,
        assignmentContainer = _assignments,
        assignmentID = args.assignmentID,
        unarchive = args.unarchive || false,
        assignment;

      // ensure assignment is where it should be and get a reference
      if (unarchive) {
        // assignment should be in _archive.all
        if (assignmentID in _archive.all)
          assignment = _archive.all[assignmentID];
        else {
          // not where it should be, break
          console.log('assignment ' + assignmentID + ' missing from memory');
          return false;
        }
      } else {
        // assignment should be in _assignments.all
        if (assignmentID in _assignments.all)
          assignment = _assignments.all[assignmentID];
        else {
          // not where it should be, break
          console.log('assignment ' + assignmentID + ' missing from memory');
          return false;
        }
      }

      // -1.A
      // reverse everything if unarchive is true:
      // remove from archiveIDs and _archive here...
      if (unarchive) {
        path += 'archive/';
        idsContainer = archiveIDs;
        assignmentContainer = _archive;
        ga('send', 'event', 'Task', 'task unarchived');
      } else {
        ga('send', 'event', 'Task', 'task archived');
      }

      // 1.

      // 1.A
      if (idsContainer.to_me.indexOf(assignmentID) > -1) {
        to_me = true;
        FBRef.child(path + 'to/' + _currentUser.uid).set(popFromList(assignmentID, idsContainer['to_me']));
      }
      else if (idsContainer.unassigned.indexOf(assignmentID) > -1) {
        to_me = false;
        FBRef.child(path + 'unassigned').set(popFromList(assignmentID, idsContainer['unassigned']));
      }
      else {
        return;
      }

      // 1.B
      FBRef.child(path + 'by/' + _currentUser.uid).set(popFromList(assignmentID, idsContainer['by_me']));

      // 1.C
      FBRef.child(path + 'all/' + assignmentID).remove();

      // -1.B
      if (unarchive) {
        path = "team/" + _team.name + "/assignments/";
        idsContainer = assignmentIDs;
        assignmentContainer = _assignments;
      } else {
        path += 'archive/';
        idsContainer = archiveIDs;
        assignmentContainer = _archive;
      }

      // 2.

      // 2.A
      // for this and 2.B, have to get list from server (in add to archive case)
      if (to_me) {
        FBRef.child(path + 'to/' + _currentUser.uid).once('value', function(data){
          data = data.val();
          idsContainer['to_me'] = data || [];
          idsContainer['to_me'].push(assignmentID);
          FBRef.child(path + 'to/' + _currentUser.uid).set(idsContainer['to_me']);
          if ('all' in _archive) syncArchive('to_me');
        });
      }
      else { // unassigned
        FBRef.child(path + 'unassigned').once('value', function(data){
          data = data.val();
          idsContainer['unassigned'] = data || [];
          idsContainer['unassigned'].push(assignmentID);
          FBRef.child(path + 'unassigned').set();
          if ('all' in _archive) syncArchive('unassigned');
        });
      }

      // 2.B
      FBRef.child(path + 'by/' + _currentUser.uid).once('value', function(data){
        data = data.val();
        idsContainer['by_me'] = data || [];
        idsContainer['by_me'].push(assignmentID);
        FBRef.child(path + 'by/' + _currentUser.uid).set(idsContainer['by_me']);
      });

      // 2.C
      FBRef.child(path + 'all/' + assignmentID).set(assignment); // remote

      // 2.D
      if (unarchive)
        delete _archive.all[assignmentID];
      else
        _archive.all[assignmentID] = assignment; // local, since archive isn't watched
    }

    /**
    *
    * adds a task
    * 1. check & format input
    * 2. push to db
    *
    */
    var _addTask = function(newTask) {
      registerAsync(doAddTask, newTask);
    }

    var doAddTask = function(newTask) {
      ga('send', 'event', 'Task', 'task added');

      // 1. format object to send to db
      // these two to be implemented
      var taskPrefix = '';

      var status = {
        time: new Date().getTime()
      };

      // check for required strings
      var strings = ['name', 'taskPrefix', 'assigned_by'];
      for (var i in strings) {
        if ((typeof newTask[strings[i]]).toLowerCase() === 'string') {
          status[strings[i]] = newTask[strings[i]];
        } else {
          console.log('required property "' + strings[i] + '" not found in newTask; aborting');
          return;
        }
      }

      // check for required numbers
      var numbers = ['priority'];
      for (var i in numbers) {
        if ((typeof newTask[numbers[i]]).toLowerCase() === 'number') {
          status[numbers[i]] = newTask[numbers[i]];
        } else {
          console.log('required property "' + numbers[i] + '" not found in newTask; aborting');
          return;
        }
      }

      // check for location
      if ((typeof newTask.location).toLowerCase() === 'object' &&
          (typeof newTask.location.lat).toLowerCase() === 'number' &&
          (typeof newTask.location.long).toLowerCase() === 'number') {
        status.location = {
          lat : newTask.lat,
          long : newTask.long
        }
      }

      // check for optional strings
      var strings = ['cat', 'weather', 'photo'];
      for (var i in strings) {
        if ((typeof newTask[strings[i]]).toLowerCase() === 'string') {
          status[strings[i]] = newTask[strings[i]];
        }
      }

      // check for optional numbers
      var numbers = ['deadline'];
      for (var i in numbers) {
        if ((typeof newTask[numbers[i]]).toLowerCase() === 'number') {
          status[numbers[i]] = newTask[numbers[i]];
        }
      }


      // 2. push to db

      // 2A add task to team/(teamname)/assignments/all
      // 2B add references to /to/assignee or /unassigned and /by/me

      var team = $scope.team.name,
        assignmentsRef = FBRef.child('team/' + team + '/assignments');

      // 2A
      var newTaskRef = assignments.child('all').push(status);
      var newTaskID = newTaskRef.key();
      // 2B
      assignmentIDs['by_me'].push(newTaskID);
      assignmentsRef.child('by/' + _currentUser.uid).set(assignmentIDs['by_me']);

      // get array, push (array style), send back to server
      var path = newTask.unassigned ? 'unassigned' : 'to/' + newTask.assignee.uid;
      assignmentsRef.child(path).once('value', function(data) {
        data = data.val();
        data = data || [];
        data.push(newTaskID);
        assignmentsRef.child(path).set(data);
      });
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
      var task = angular.copy(_assignments.all[assignmentID]);

      // update time to now and place to here (feature pending)
      task.time = new Date().getTime();
      // task.lat = $scope.lat ? $scope.lat : 0;
      // task.long = $scope.long ? $scope.long : 0;

      // in case of unassigned tasks, which don't have a user property
      task.user = _currentUser.uid;

      // update original assignment status to In Progress
      _setAssignmentStatus(assignmentID, Phased.TASK_STATUS_ID.IN_PROGRESS);

      // publish to stream
      var ref = FBRef.child('team/' + _team.name);
      ref.child('task/' + _currentUser.uid).set(task);
      ref.child('all/' + _currentUser.uid).push(task, function() {
        console.log('status update complete');
      });
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
      if (!(newStatus in _taskStatuses)) { // not a valid ID
        var i = _taskStatuses.indexOf(newStatus);
        if (i !== -1) {
          console.log(newStatus + ' is a valid status name');
          newStatus = i; // set newStatus to be status ID, not name
        } else {
          console.log('err: ' + newStatus + ' is not a valid status name or ID');
          return;
        }
      }
      ga('send', 'event', 'Task', 'status update: ' + _taskStatuses[newStatus]);

      // push to database
      FBRef.child('team/' + _team.name + '/assignments/all/' + assignmentID + '/status').set(newStatus);
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
      var assignmentsPath = 'team/' + _team.name + '/assignments/';

      // 1. remove task from /unassigned
      delete assignmentIDs.unassigned[assignmentIDs.unassigned.indexOf(assignmentID)];
      FBRef.child(assignmentsPath + 'unassigned').set(assignmentIDs.unassigned);

      // 2. add task to /to/(me)
      assignmentIDs.to_me.push(assignmentID);
      FBRef.child(assignmentsPath + 'to/' + _currentUser.uid).set(assignmentIDs.to_me);

      // 3. set user attr
      FBRef.child(assignmentsPath + 'all/' + assignmentID + '/user').set(_currentUser.uid);
    }

    /**
    **
    **  Utilities
    **
    **/

    /**
    *
    * remove an item from an array
    * returns the new array
    *
    */
    var popFromList = function(item, list) {
      var i = list.indexOf(item);
      while (i > -1) {
        delete list[i];
        i = list.indexOf(item);
      }
      return list;
    }

    // convert object into array
    // useful for arrays with missing keys
    // eg, [0 = '', 1 = '', 3 = ''];
    var objToArray = function(obj) {
      var newArray = [];
      for (var i in obj) {
        newArray.push(obj[i]);
      }
      return newArray;
    }


  })
  .config(['PhasedProvider', 'FURL', 'AuthProvider', function(PhasedProvider, FURL, AuthProvider) {
    PhasedProvider.setFBRef(FURL);
    // configure phaseProvider as a callback to AuthProvider
    AuthProvider.setDoAfterAuth(PhasedProvider.init);
  }]);