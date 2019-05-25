/**
 * Io is a tool for handling large forms.
 * It can watch for changes, pauses, validate, and provide helpers for views.
 * It also works with arrays of objects for complex validation and data collection.
 *
 * Basic Usage:
 * const io = new Io({
 *      form: {
 *          name: null,
 *          genres: [],
 *          services: [],
 *      },
 *
 *      validation: {
 *          'name': 'required|string',
 *          'genres': 'required|array',
 *          'services.*.url': 'required|url',
 *      }
 * })
 *
 * When a field's value changes:
 * io.on('change', data => { ... })
 *
 * When a field's value stops changing:
 * io.on('paused:name', data => { ... })
 *
 * Use feedback helper for error/success messages:
 * <ui-field v-bind="io.feedback.name" />
 */

import Bag from './bag'

export default class Io {
    /**
     * Create a new Flow instance.
     */
    constructor(options) {
        for (let key in options) {
            this[key] = options[key]
        }

        this._vue = new Vue()
        this._events = []
        this._watchers = []
        this._inputTimeouts = []

        this.errors = new Bag(this.errors || {}, 'Error')
        this.success = new Bag(this.success || {}, 'Success')
        this.form = Vue.observable(this.form)
        this.feedback = {}

        this.startWatching(this.form)
        this.createFeedback()

        this.errors.on('update', () => this.createFeedback())
        this.success.on('update', () => this.createFeedback())

        this.io = this
    }

    /**
     * Attach the given class.
     * This is just syntax sugar.
     */
    attach(plugin) {
        plugin.attachToIo(this)

        return this
    }

    /**
     * Updates the form with the given data.
     * Will retain data that hasn't changed.
     */
    update(data = {}) {
        for (let key in data) {
            this.form[key] = data[key]
        }

        this.stopWatching()
        this.startWatching(this.form)
        this.createFeedback()

        return this
    }

    /**
     * Determine if the given fields are filled.
     */
    filled(fields) {
        for (let field of fields) {
            if (! truthy(this.form[field])) {
                return false
            }
        }

        return true
    }

    /**
     * Creates the feedback object.
     * Will update on every change.
     */
    createFeedback() {
        let feedback = {}

        for (let key in this.validation) {
            if (/\*+/g.test(key)) {
                // Is part of an array
                let segments = key.split('.')
                let node = this.form

                for (let segment of segments) {
                    if (segment !== '*') {
                        node = node[segment]
                    } else {
                        for (const [index, item] of node.entries()) {
                            _.set(feedback, key.replace('*', index), {
                                error: this.errors.get(key, index),
                                success: this.success.get(key, index),
                            })
                        }
                    }
                }
            } else {
                _.set(feedback, key, {
                    error: this.errors.get(key),
                    success: this.success.get(key),
                })
            }
        }

        this.feedback = feedback

        return this
    }

    /**
     * Determine if the given path is deep.
     * services.*.name -> true
     * metadata.website -> true
     * name -> false
     */
    isDeepPath(key) {
        return /[\.*]+/g.test(key)
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
     * Determines if the given array is full of objects.
     */
    isArrayOfObjects(value) {
        return Array.isArray(value)
            && value.length
            && typeof value[0] === 'object'
            && ! Array.isArray(value[0])
            && value[0] !== null
    }

    /**
     * Determine if the given value is an object.
     */
    isObject(value) {
        return ! Array.isArray(value)
            && typeof value === 'object'
            && value !== null
    }

    /**
     * Determines if the given value is simple.
     * string|number|boolean|null|undefined
     */
    isSimpleType(value) {
        return ! Array.isArray(value)
            && (typeof value !== 'object' || value === null)
    }

    /**
     * Tears down all the watchers.
     */
    stopWatching() {
        for (let watcher of this._watchers) {
            watcher.unwatch()
        }

        this._watchers = []

        return this
    }

    /**
     * Starts watching the form for changes.
     */
    startWatching(object, path = []) {
        for (const [field, value] of Object.entries(object)) {
            path.push(field)

            if (this.isObject(value)) {
                this.startWatching(object[field], path.slice(0))
                path.pop()
            }

            if (this.isArrayOfObjects(value)) {
                for (let [index, item] of value.entries()) {
                    this.startWatching(item, [...path, index])
                }

                path.pop()
            }

            let joinedPath = path.join('.')

            if (! _.find(this._watchers, ['path', joinedPath])) {
                this._watchers.push({
                    path: joinedPath,
                    unwatch: this._vue.$watch(() => _.get(this.form, joinedPath), (value, oldValue) => {
                        if (! _.isEqual(value, oldValue)) {
                            this.onChange({ field, path: joinedPath, value, oldValue })
                        }

                        this.stopWatching()
                        this.startWatching(this.form)
                    }, { deep: true })
                })
            }

            path.pop()
        }
    }

    /**
     * Reset the input timeout event.
     */
    resetInputTimeout(path) {
        let timeout = _.find(this._inputTimeouts, ['path', path])

        if (timeout) {
            clearTimeout(timeout.handle)
            this._inputTimeouts.splice(_.findIndex(this._inputTimeouts, ['path', path]), 1)
        }

        this._inputTimeouts.push({
            path,
            handle: setTimeout(() => {
                this.emit('paused', {
                    path,
                    value: _.get(this.form, path),
                    error: this.errors.get(path),
                    success: this.success.get(path),
                })

                this.emit(`paused:${path}`, {
                    path,
                    value: _.get(this.form, path),
                    error: this.errors.get(path),
                    success: this.success.get(path),
                })
            }, 2000)
        })

        return this
    }

    /**
     * Called when a form field has changed.
     */
    onChange(payload) {
        const errors = this.validate(payload)

        this.resetInputTimeout(payload.path)
        this.createFeedback()

        this.emit('change', Object.assign(payload, { errors }))
    }

    /**
     * Validate the given field.
     */
    validate({ path }) {
        let rules = this.getRules(path)

        try {
            new Validate(this.form, { [this.toWildcardPath(path)]: rules })

            this.errors.clear(path)
        } catch (errors) {
            this.errors.record(errors)

            return errors
        }

        return {}
    }

    /**
     * Converts an indexed path to wildcard.
     * Eg. array.0.name -> array.*.name
     */
    toWildcardPath(path) {
        return _.map(path.split('.'), segment => {
            if (/^\d*$/.test(segment)) {
                return '*'
            }

            return segment
        }).join('.')
    }

    /**
     * Gets the rules for the given field.
     */
    getRules(path) {
        if (path.includes('.')) {
            // We're dealing with an array of objects rule
            path = this.toWildcardPath(path)
        }

        return this.validation[path]
    }
}
