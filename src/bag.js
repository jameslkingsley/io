export default class Bag {
    /**
     * Create a new Bag instance.
     */
    constructor(bag = {}, label = null) {
        this.bag = bag
        this.label = label
        this._events = []
    }

    /**
     * Register a handler for the given event.
     */
    on(name, closure) {
        this._events.push({
            name, closure
        })

        return this
    }

    /**
     * Emits the payload for the event.
     */
    emit(event, payload) {
        for (let handler of _.filter(this._events, ['name', event])) {
            handler.closure(payload)
        }

        return this
    }

    /**
     * Determine if a message exists for the given field.
     *
     * @param {string} field
     */
    has(field) {
        return this.bag.hasOwnProperty(field)
    }

    /**
     * Determine if we have any messages.
     */
    any(fields = null) {
        if (fields) {
            return _.filter(Object.keys(this.bag), key => {
                return fields.includes(key)
            }).length > 0
        }

        return walkObjectForTruth(this.bag)
    }

    /**
     * Retrieve the message for a field.
     *
     * @param {string} field
     */
    get(field, index = null) {
        let key = field

        if (index !== null) {
            key = key.replace('*', index)
        }

        if (this.bag[key]) {
            return this.label && ! this.bag[key][0].includes(':')
                ? `${this.label}: ${this.bag[key][0]}`
                : this.bag[key][0]
        }
    }

    /**
     * Record the new message.
     *
     * @param {object} messages
     */
    record(messages) {
        this.bag = Object.assign(this.bag, _.mapValues(messages, message => {
            return Array.isArray(message) ? message : [message]
        }))

        this.emit('update')
    }

    /**
     * Replace all messages.
     *
     * @param {object} messages
     */
    replace(messages) {
        this.bag = messages

        this.emit('update')
    }

    /**
     * Clear one or all message fields.
     *
     * @param {string|null} field
     */
    clear(field) {
        if (field) {
            delete this.bag[field]

            return
        }

        this.bag = {}
        this.emit('update')
    }
}
