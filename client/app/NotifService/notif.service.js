'use strict'

angular.module('webappApp')
	.service('Notif', ['Phased', '$rootScope', function(Phased, $rootScope) {

		// notification type ids
		var TYPE = {
			HISTORY : 'history',
			ASSIGNMENT : {
				CREATED : 'assignment_created',
				ARCHIVED : 'assignment_archived',
				UNARCHIVED : 'assignment_unarchived',
				UPDATED : 'assignment_updated', // generic case
				ASSIGNED : 'assignment_assigned',
				ASSIGNED_TO_ME : 'assignment_assigned_to_me',
				STATUS : 'assignment_status'
			}
		};
		this.TYPE = TYPE;

		// the main notification stream, exposed to controller
		this.stream = [];
		var mainStream = this.stream;

		// a list of notification keys that have been read
		// these correspond to the items' firebase keys
		// (for assignment histories, these are the keys in
		// assignments/all/$assignment/history)
		this.read = [];
		var _read = this.read;

		// use PhasedProvider's FBRef to gather current read list
		$rootScope.$on('Phased:currentUserProfile', function() {
			Phased.FBRef.child('team/' + Phased.team.name + '/read/' + Phased.user.uid).once('value', function(data){
				var list = data.val();
				// add to list if not there
				// need to do this way in order to maintain reference
				for (var i in list) {
					if (_read.indexOf(i) < 0)
						_read.push(list[i]);
				}
			});
		});

		/**
		*
		*	a manager for various streams 
		*	allows to clear all items from one stream without 
		*	clearing the main stream
		*
		*/
		var NotifStreamHolder = function() {
			var items = [];

			// clears items in stream
			this.clear = function() {
				while (items.length != 0) { 
					// remove from this stream
					var curItem = items.pop();

					// remove from main stream
					for (var i in mainStream) {
						if (curItem.time == mainStream[i].time) {
							mainStream.splice(i, 1);
							break;
						}
					}
				}
			}

			// adds an iteam to the stream
			this.addItem = function(item) {
				// check item properties
				var props = ['title', 'body', 'time', 'key'];
				for (var i in props) {
					if (!item[props[i]]) {
						console.log('item missing property "' + props[i] + '"');
						return false;
					}
				}

				// add item
				items.push(item);
				mainStream.push(item);
			}

			this.getLength = function() {
				return items.length;
			}
		}

		/**
			The various streams that will be amalgamated to form the exposed notification stream
		**/
		var histStream = new NotifStreamHolder();
		var assignmentStream = new NotifStreamHolder(); // all assignments
		var assignmentArchiveStream = new NotifStreamHolder(); // archived assignments


		/**
		*
		*	populates history stream from Phased.team.history
		*
		*	(basically just formats the Phased.team.history objects
		*	and shoves 'em in)
		*/

		var populateHistStream = function() {
			histStream.clear();

			for (var i in Phased.team.history) {
				var curItem = Phased.team.history[i];
				var streamItem = {
					title : Phased.team.members[curItem.user].name,
					img : Phased.team.members[curItem.user].pic,
					body : curItem.name,
					time : curItem.time,
					cat : curItem.cat,
					type : 'history',
					key : curItem.key
				}
				histStream.addItem(streamItem);
			}
		}
		$rootScope.$on('Phased:history', populateHistStream);

		/**
		*
		*	populates assignment stream with all assignment data
		*	using snapshots in their history objects if available
		*
		*/

		var populateAssignments = function(archive) {
			var stream = assignmentStream,
				container = Phased.assignments.all;
			if (archive) {
				stream = assignmentArchiveStream;
				container = Phased.archive.all;
			}

			stream.clear();

			// for every assignment
			for (var i in container) {
				var curAssignment = container[i];

				// if assignment has history (as it should)
				if ('history' in curAssignment) {
					// add each of its snapshots to the notification stream
					for (var j in curAssignment.history) {
						var curItem = curAssignment.history[j]; // easier reference for the current item

						// format the notification depending on the history type
						switch (curItem.type) {
							/**
							*		TASK CREATED
							*/
							case Phased.TASK_HISTORY_CHANGES.CREATED :
								var streamItem = {
									body : curItem.taskSnapshot.name,
									time : curItem.time,
									cat : curItem.taskSnapshot.cat,
									type : TYPE.ASSIGNMENT.CREATED
								}

								// make title :
								// 1 assigned by A to ME
								// 2 assigned by ME (to A or unassigned)
								// 3 assigned by A to B
								// 4 self-assigned by ME
								// 5 self-assigned by A
								// 6 unassigned by A

								if (curItem.taskSnapshot.assigned_by != curItem.taskSnapshot.assignee) { // 1, 2, 3, or 6
									if (curItem.taskSnapshot.assignee == Phased.user.uid) { 
										// 1
										streamItem.title = 'New task assigned to you by ' + Phased.team.members[curItem.taskSnapshot.assigned_by].name;
									} else if (curItem.taskSnapshot.assigned_by == Phased.user.uid) { 
										// 2
										if (curItem.taskSnapshot.assignee)
											streamItem.title = 'You assigned a new task to ' + Phased.team.members[curItem.taskSnapshot.assignee].name;
										else 
											streamItem.title = 'You created an unassigned task';
									} else if (curItem.taskSnapshot.assignee) { 
										// 3
										streamItem.title = Phased.team.members[curItem.taskSnapshot.assigned_by].name; + ' assigned a new task to ' + Phased.team.members[curItem.taskSnapshot.assignee].name;
									} else if (typeof curItem.taskSnapshot.assignee == 'undefined' && curItem.taskSnapshot.unassigned) { // 6
										streamItem.title = Phased.team.members[curItem.taskSnapshot.assigned_by].name; + ' created a new unassigned task';
									}
								} else { // 4 or 5 (self-assigned)
									if (curItem.taskSnapshot.assigned_by == Phased.user.uid) { 
										// 4
										streamItem.title = 'You self-assigned a new task';
									} else {
										streamItem.title = Phased.team.members[curItem.taskSnapshot.assigned_by].name + ' self-assigned a new task';
									}
								}
								break;
							/**
							*		TASK ARCHIVED
							*		nb: an archived task snapshot could appear in an active task's history
							*/
							case Phased.TASK_HISTORY_CHANGES.ARCHIVED :
								var streamItem = {
									title : 'Task archived',
									body : curItem.taskSnapshot.name,
									time : curItem.time,
									cat : curItem.taskSnapshot.cat,
									type : TYPE.ASSIGNMENT.ARCHIVED
								}
								break;
							/**
							*		TASK UNARCHIVED
							*/
							case Phased.TASK_HISTORY_CHANGES.UNARCHIVED :
								var streamItem = {
									title : 'Task unarchived',
									body : curItem.taskSnapshot.name,
									time : curItem.time,
									cat : curItem.taskSnapshot.cat,
									type : TYPE.ASSIGNMENT.UNARCHIVED
								}
								break;
							/**
							*		TASK NAME CHANGED
							*/
							case Phased.TASK_HISTORY_CHANGES.NAME :
								var streamItem = {
									title : 'Task name changed',
									body : 'to "' + curItem.taskSnapshot.name + '"',
									time : curItem.time,
									cat : curItem.taskSnapshot.cat,
									type : TYPE.ASSIGNMENT.UPDATED
								}
								break;
							/**
							*		TASK DESC CHANGED
							*/
							case Phased.TASK_HISTORY_CHANGES.DESCRIPTION :
								var streamItem = {
									title : 'Task description changed',
									body : curItem.taskSnapshot.name,
									time : curItem.time,
									cat : curItem.taskSnapshot.cat,
									type : TYPE.ASSIGNMENT.UPDATED
								}
								break;

							/**
							*		TASK ASSIGNEE CHANGED
							*/
							case Phased.TASK_HISTORY_CHANGES.ASSIGNEE :
								var streamItem = {
									title : 'Task assigned to ' + Phased.team.members[curItem.taskSnapshot.assignee].name,
									body : curItem.taskSnapshot.name,
									time : curItem.time,
									cat : curItem.taskSnapshot.cat,
									type : TYPE.ASSIGNMENT.ASSIGNED
								}

								if (curItem.taskSnapshot.assigned_by == Phased.user.uid) { // task assigned to me
									streamItem.title = 'Task assigned to you';
									streamItem.type = TYPE.ASSIGNMENT.ASSIGNED_TO_ME;
								}
								break;
							/**
							*		TASK DEADLINE CHANGED
							*/
							case Phased.TASK_HISTORY_CHANGES.DEADLINE :
								var streamItem = {
									title : 'Task deadline changed',
									body : curItem.taskSnapshot.name,
									time : curItem.time,
									cat : curItem.taskSnapshot.cat,
									type : TYPE.ASSIGNMENT.UPDATED
								}
								break;
							/**
							*		TASK PRIORITY CHANGEd
							*/
							case Phased.TASK_HISTORY_CHANGES.CATEGORY :
								var streamItem = {
									title : 'Task category changed',
									body : curItem.taskSnapshot.name,
									time : curItem.time,
									cat : curItem.taskSnapshot.cat,
									type : TYPE.ASSIGNMENT.UPDATED
								}
								break;

							/**
							*		TASK PRIORITY CHANGED
							*/
							case Phased.TASK_HISTORY_CHANGES.PRIORITY :
								var streamItem = {
									title : 'Task priority changed',
									body : curItem.taskSnapshot.name,
									time : curItem.time,
									cat : curItem.taskSnapshot.cat,
									type : TYPE.ASSIGNMENT.UPDATED
								}
								break;

							/**
							*		TASK STATUS CHANGED
							*/
							case Phased.TASK_HISTORY_CHANGES.STATUS :
								var streamItem = {
									title : 'Task status changed',
									body : curItem.taskSnapshot.name,
									time : curItem.time,
									cat : curItem.taskSnapshot.cat,
									type : TYPE.ASSIGNMENT.STATUS
								}
								switch (curItem.taskSnapshot.status) {
									case Phased.TASK_STATUS_ID.IN_PROGRESS :
										streamItem.title = 'Task in progress';
										break;
									case Phased.TASK_STATUS_ID.COMPLETE :
										streamItem.title = 'Task completed';
										break;
									case Phased.TASK_STATUS_ID.ASSIGNED :
										streamItem.title = 'Task assigned';
										break;
									default:
										break;
								}
								break;
							/**
							*		TASK UPDATED (generic)
							*/
							default :
								var streamItem = {
									title : 'Task updated',
									body : curItem.taskSnapshot.name + ' (by ' + Phased.team.members[curItem.taskSnapshot.assigned_by].name + ')', 
									time : curItem.time,
									cat : curItem.taskSnapshot.cat,
									type : TYPE.ASSIGNMENT.UPDATED
								}
								break;
						}

						streamItem.key = j;
						stream.addItem(streamItem);
					}
				} else { // if no history (to be backwards compatible)
					var streamItem = {
						title : 'Task updated',
						body : curAssignment.name + ' (by ' + Phased.team.members[curAssignment.assigned_by].name + ')', 
						time : curAssignment.time,
						cat : curAssignment.cat,
						type : TYPE.ASSIGNMENT.UPDATED
					}
					streamItem.key = i;
					stream.addItem(streamItem);
				}
			}
		}
		$rootScope.$on("Phased:assignments:data", function() { 
			populateAssignments()
		});
		$rootScope.$on("Phased:assignments:archive:data", function() { 
			populateAssignments(true); // use archive
		});

		/**
		*
		*	Mark all notifications as read
		*
		*/

		this.markAllRead = function() {
			// push key to read array
			for (var i in mainStream) {
				if (_read.indexOf(mainStream[i].key) < 0)
					_read.push(mainStream[i].key);
			}

			// push to server
			Phased.FBRef.child('team/' + Phased.team.name + '/read/' + Phased.user.uid)
				.set(_read);
				// .set(null);
		}

	}]);