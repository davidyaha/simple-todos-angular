Tasks = new Mongo.Collection('tasks');

Tasks.attachSchema(new SimpleSchema({
  text: {
    type: String,
    min: 1
  },
  createdAt: {
    type: Date
  },
  owner: {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
    index: 1
  },
  username: {
    type: String,
    min: 1,
    index: 1
  },
  checked: {
    type: Boolean,
    index: 1,
    optional: true
  },
  private: {
    type: Boolean,
    index: 1,
    optional: true
  },
  type: {
    type: String,
    allowedValues: ['repeated', 'once'],
    defaultValue: 'once'
  },
  repeatsEvery: {
    type: String,
    allowedValues: ['day', 'week', 'month', 'year'],
    optional: true
  }
}));

if (Meteor.isClient) {

  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  });

  // This code only runs on the client
  angular.module('simple-todos',['angular-meteor', 'accounts.ui']);

  function onReady() {
    angular.bootstrap(document, ['simple-todos']);
  }

  if (Meteor.isCordova)
    angular.element(document).on('deviceready', onReady);
  else
    angular.element(document).ready(onReady);

  angular.module('simple-todos').controller('TodosListCtrl', ['$scope', '$meteor',
    function ($scope, $meteor) {

      $scope.$meteorSubscribe('tasks');

      $scope.tasks = $meteor.collection(function() {
        return Tasks.find($scope.getReactively('query'), {sort: {createdAt: -1}})
      });

      $scope.types = Tasks.simpleSchema()._schema.type.allowedValues;

      $scope.addTask = function (newTask) {
        $meteor.call('addTask', newTask);
      };

      $scope.deleteTask = function (task) {
        $meteor.call('deleteTask', task._id);
      };

      $scope.setChecked = function (task) {
        $meteor.call('setChecked', task._id, !task.checked);
      };

      $scope.setPrivate = function (task) {
        $meteor.call('setPrivate', task._id, ! task.private);
      };

      $scope.setType = function(task) {
        $meteor.call('setType', task._id, task.type);
      };

      $scope.setRepeatsEvery = function(task, repeatsEvery) {
        $meteor.call('setRepeatsEvery', task._id, repeatsEvery);
      };

      $scope.$watch('hideCompleted', function() {
        if ($scope.hideCompleted)
          $scope.query = {checked: {$ne: true}};
        else
          $scope.query = {};
      });

      $scope.incompleteCount = function () {
        return Tasks.find({ checked: {$ne: true} }).count();
      };

    }]);
}

Meteor.methods({
  addTask: function (text) {
    // Make sure the user is logged in before inserting a task
    if (! Meteor.userId()) {
      throw new Meteor.Error('not-authorized');
    }

    Tasks.insert({
      text: text,
      createdAt: new Date(),
      owner: Meteor.userId(),
      username: Meteor.user().username
    });
  },
  deleteTask: function (taskId) {
    var task = Tasks.findOne(taskId);
    if (task.private && task.owner !== Meteor.userId()) {
      // If the task is private, make sure only the owner can delete it
      throw new Meteor.Error('not-authorized');
    }

    Tasks.remove(taskId);
  },
  setChecked: function (taskId, setChecked) {
    var task = Tasks.findOne(taskId);
    if (task.private && task.owner !== Meteor.userId()) {
      // If the task is private, make sure only the owner can check it off
      throw new Meteor.Error('not-authorized');
    }

    Tasks.update(taskId, { $set: { checked: setChecked} });
  },
  setPrivate: function (taskId, setToPrivate) {
    var task = Tasks.findOne(taskId);

    // Make sure only the task owner can make a task private
    if (task.owner !== Meteor.userId()) {
      throw new Meteor.Error('not-authorized');
    }

    Tasks.update(taskId, { $set: { private: setToPrivate } });
  },
  setType: function (taskId, type) {
    var task = Tasks.findOne(taskId);

    // Make sure only the task owner can change task's type
    if (task.owner !== Meteor.userId()) {
      throw new Meteor.Error('not-authorized');
    }

    if (type === 'once')
      Tasks.update(taskId, { $set: { type: type }, $unset: { repeatsEvery: '' } });
    else
      Tasks.update(taskId, { $set: { type: type , repeatsEvery: 'day'} });
  },
  setRepeatsEvery: function (taskId, repeatsEvery) {
    var task = Tasks.findOne(taskId);

    // Make sure only the task owner can change repeat every
    if (task.owner !== Meteor.userId()) {
      throw new Meteor.Error('not-authorized');
    }

    // Make sure the task is a repeated task
    if (task.type !== 'repeated') {
      throw new Meteor.Error('not-allowed')
    }

    Tasks.update(taskId, { $set: { repeatsEvery: repeatsEvery } });
  }
});

if (Meteor.isServer) {
  Meteor.publish('tasks', function () {
    return Tasks.find({
      $or: [
        { private: {$ne: true} },
        { owner: this.userId }
      ]
    });
  });
}
