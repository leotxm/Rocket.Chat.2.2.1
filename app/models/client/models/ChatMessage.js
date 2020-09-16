import { Mongo } from 'meteor/mongo';

export const ChatMessage = new Mongo.Collection(null);

ChatMessage.setReactions = function(messageId, reactions) {
	return this.update({ _id: messageId }, { $set: { reactions } });
};

ChatMessage.unsetReactions = function(messageId) {
	return this.update({ _id: messageId }, { $unset: { reactions: 1 } });
};

ChatMessage.setVote = function(messageId, votes) {
	return this.update({ _id: messageId }, { $set: { votes } });
};

ChatMessage.unsetVote = function(messageId) {
	return this.update({ _id: messageId }, { $unset: { votes: 1 } });
};
