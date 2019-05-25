import isEmail from 'validator/lib/isEmail'

class BreakToNextField {
    //
}

export default class Validate {
    constructor(data, rules, customTest = null, overrideIndex = null) {
        this._data = data
        this._rules = rules
        this._customTest = customTest
        this._overrideIndex = overrideIndex

        this.validate()
    }

    localize(name, data = null) {
        let text = Push.app.$t(`validation.${name}`)

        if (data) {
            for (let key in data) {
                text = text.replace(`{${key}}`, data[key])
            }
        }

        return text
    }

    nullable(value) {
        if (! value) {
            return new BreakToNextField()
        }

        return true
    }

    date(value) {
        try {
            if (moment(value).isValid()) {
                return true
            }

            throw this.localize('date')
        } catch (error) {
            throw this.localize('date')
        }
    }

    time(value) {
        if (/\d{2,}:\d{2,}:*\d*/.test(value)) {
            if (moment(`2000-01-01 ${value}`).isValid()) {
                return true
            }

            throw this.localize('time')
        }

        throw this.localize('time')
    }

    array(value) {
        if (Array.isArray(value)) {
            return true
        }

        throw this.localize('array')
    }

    object(value) {
        if (typeof value === 'object') {
            return true
        }

        throw this.localize('object')
    }

    url(value) {
        try {
            new URL(value)
            return true
        } catch (error) {
            throw this.localize('url')
        }
    }

    boolean(value) {
        if (typeof value === 'boolean') {
            return true
        }

        throw this.localize('boolean')
    }

    accepted(value) {
        if (typeof value === 'boolean' && value) {
            return true
        }

        throw this.localize('accepted')
    }

    integer(value) {
        if (! isNaN(Number(value))) {
            return true
        }

        throw this.localize('integer')
    }

    required(value) {
        if (Array.isArray(value)) {
            if (value.length == 0) {
                throw this.localize('required')
            } else {
                return true
            }
        }

        if (value && value !== null) {
            return true
        }

        throw this.localize('required')
    }

    requiredWith(value, field) {
        console.log(value, field, this._data[field], truthy(this._data[field]))
        if (truthy(this._data[field])) {
            return this.required(value)
        }

        return true
    }

    string(value) {
        if (value === null || typeof value === 'string') {
            return true
        }

        throw this.localize('string')
    }

    email(value) {
        if (typeof value !== 'string') {
            throw this.localize('string')
        }

        if (isEmail(value)) {
            return true
        }

        throw this.localize('email')
    }

    min(value, count) {
        if (typeof value === 'string') {
            if (value.length < count) {
                throw this.localize('min_string', { count })
            }

            return true
        }

        if (typeof value === 'number') {
            if (value < count) {
                throw this.localize('min_number', { count })
            }

            return true
        }

        throw this.localize('min_unknown')
    }

    validate() {
        this._bag = {}

        for (let field in this._rules) {
            if (field.includes('.')) {
                const nodes = field.split('.')
                let value = this._data[nodes.shift()]

                if (typeof value == 'undefined') continue

                for (let node of nodes) {
                    if (node == '*') {
                        for (const [index, item] of value.entries()) {
                            try {
                                const baseName = field.split('.').pop()
                                new Validate(item, { [baseName]: this._rules[field] })
                            } catch (errors) {
                                for (let key in errors) {
                                    this._bag[field.replace('*', this._overrideIndex || index)] = errors[key]
                                }
                            }
                        }
                    } else {
                        value = value[node]
                    }
                }
            }

            const subject = _.get(this._data, field)

            this._bag[field] = []

            for (let rule of this.parseRules(this._rules[field])) {
                let ruleMethodName = _.camelCase(rule.method)

                if (typeof rule.method == 'string' && typeof this[ruleMethodName] !== 'function') {
                    throw `${ruleMethodName}() is not a validator method`
                }

                try {
                    let result = this[ruleMethodName](subject, ...rule.arguments)

                    if (result instanceof BreakToNextField) {
                        break
                    }
                } catch (error) {
                    this._bag[field].push(error.replace('{name}', _.lowerCase(field)))
                }
            }
        }

        const nonEmptyFields = _.filter(Object.keys(this._bag), field => this._bag[field].length > 0)
        let filledErrors = _.pick(this._bag, nonEmptyFields)

        if (this._customTest) {
            filledErrors = Object.assign(filledErrors, this._customTest())
        }

        if (Object.keys(filledErrors).length > 0) {
            throw filledErrors
        }

        return true
    }

    parseRules(rules) {
        return _.map(
            typeof rules == 'string'
                ? rules.split('|')
                : rules,
            rule => this.parseRule(rule)
        )
    }

    parseRule(rule) {
        const hasArgument = rule.includes(':')

        return {
            method: hasArgument ? rule.split(':')[0] : rule,
            arguments: hasArgument ? rule.split(':')[1].split(',') : [],
        }
    }
}
