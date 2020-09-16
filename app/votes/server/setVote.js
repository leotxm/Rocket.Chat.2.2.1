import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { TAPi18n } from 'meteor/rocketchat:tap-i18n';
import _ from 'underscore';

import { Messages, Subscriptions } from '../../models';
import { Notifications } from '../../notifications';
import { callbacks } from '../../callbacks';
import { msgStream } from '../../lib';

const VOTE_TYPE = {
	UPVOTE: 'upvote',
	DOWNVOTE: 'downvote',
};

const removeUserVote = ({ message, voteType, username }) => {
	const userIndex = message.votes[voteType].indexOf(username);
	if (message.votes[voteType].length > 0) {
		message.votes[voteType].splice(userIndex, 1);
	}
	return message;
};

export function setVote(room, user, message, voteType) {
	console.log(room, user, message, voteType);
	if (voteType !== VOTE_TYPE.UPVOTE && voteType !== VOTE_TYPE.DOWNVOTE) {
		throw new Meteor.Error('error-not-allowed', 'Invalid vote type.', { method: 'setVote' });
	}

	if (voteType === VOTE_TYPE.UPVOTE
		&& message.votes[VOTE_TYPE.DOWNVOTE]
		&& message.votes[VOTE_TYPE.DOWNVOTE].find((x) => x === user.username)) { return false; }

	if (voteType === VOTE_TYPE.DOWNVOTE
		&& message.votes[VOTE_TYPE.UPVOTE]
		&& message.votes[VOTE_TYPE.UPVOTE].find((x) => x === user.username)) { return false; }

	if (room.ro && !room.reactWhenReadOnly) {
		if (!Array.isArray(room.unmuted) || room.unmuted.indexOf(user.username) === -1) {
			return false;
		}
	}

	if (Array.isArray(room.muted) && room.muted.indexOf(user.username) !== -1) {
		Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: room._id,
			ts: new Date(),
			msg: TAPi18n.__('You_have_been_muted', {}, user.language),
		});
		return false;
	} if (!Subscriptions.findOne({ rid: message.rid })) {
		return false;
	}

	const userAlreadyVoted = Boolean(message.votes) && Boolean(message.votes[voteType]) && message.votes[voteType].includes(user.username) !== -1;

	if (userAlreadyVoted) {
		removeUserVote({ message, voteType, username: user.username });
		if (_.isEmpty(message.votes)) {
			delete message.votes;
			Messages.unsetVote(message._id);
		} else if (_.isEmpty(message.votes[voteType]) || _.isNull(message.votes[voteType])) {
			delete message.votes[voteType];
			Messages.update({ _id: message._id }, { $set: { votes: message.votes } });
			callbacks.run('setVote', message._id, voteType);
		} else {
			Messages.update({ _id: message._id }, { $set: { votes: message.votes } });

			callbacks.run('setVote', message._id, voteType);
		}
	//	callbacks.run('afterUnsetVote', message, { user, voteType });
	} else {
		if (!message.votes) {
			message.votes = {};
		}
		if (!message.votes[voteType]) {
			message.votes[voteType] = [];
		}
		message.votes[voteType].push(user.username);

		Messages.update({ _id: message._id }, { $set: { votes: message.votes } });

		callbacks.run('setVote', message._id, voteType);
	}

	msgStream.emit(message.rid, message);
}

Meteor.methods({
	setVote({ msgId, voteType }) {
		const user = Meteor.user();

		const message = Messages.findOneById(msgId);
		console.log(message);

		const room = Meteor.call('canAccessRoom', message.rid, Meteor.userId());

		if (!user) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', { method: 'setReaction' });
		}

		if (!message) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', { method: 'setReaction' });
		}

		if (!room) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', { method: 'setReaction' });
		}

		setVote(room, user, message, voteType);
	},
});
