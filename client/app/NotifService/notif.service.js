'use strict'

angular.module('webappApp')
	.service('Notif', ['Phased', '$rootScope', function(Phased, $rootScope) {

		// the main notification stream, exposed to controller
		this.stream = [
			/*{
				title : 'Dummy item',
				body : 'This is just a dummy stream item. This is some text that would be in the body of the stream ...',
				img : '',
				time : 1445459283148,
				cat : 'some_cat_id',
				unread : true,
				type : 'dummy'
			}*/
		];
		var mainStream = this.stream;

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
				var props = ['title', 'body', 'time'];
				for (var i in props) {
					if (!item[props[i]]) {
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
		var assignmentToMeStream = new NotifStreamHolder();
		var assignmentUnassignedStream = new NotifStreamHolder();


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
					type : 'history'
				}
				histStream.addItem(streamItem);
			}
		}
		$rootScope.$on('Phased:history', populateHistStream);


		/**
		*
		*	populates assignment streams from Phased.assignments.to_me
		*	and Phased.assignments.unassigned
		*/
		var populateAssignmentsToMe = function() {
			assignmentToMeStream.clear();
			for (var i in Phased.assignments.to_me) {
				var curItem = Phased.assignments.to_me[i];
				var streamItem = {
					title : 'Assignment from ' + Phased.team.members[curItem.assigned_by].name,
					body : curItem.name,
					time : curItem.time,
					cat : curItem.cat,
					type : 'assignment_to_me'
				}
				assignmentToMeStream.addItem(streamItem);
			}
		}
		$rootScope.$on("Phased:assignments:to_me", populateAssignmentsToMe);

		var populateAssignmentsUnassigned = function() {
			assignmentUnassignedStream.clear();
			for (var i in Phased.assignments.unassigned) {
				var curItem = Phased.assignments.unassigned[i];
				var streamItem = {
					title : 'Open task from ' + Phased.team.members[curItem.assigned_by].name,
					body : curItem.name,
					time : curItem.time,
					cat : curItem.cat,
					type : 'assignment_unassigned'
				}
				assignmentUnassignedStream.addItem(streamItem);
			}
		}
		$rootScope.$on("Phased:assignments:unassigned", populateAssignmentsUnassigned);

	}]);