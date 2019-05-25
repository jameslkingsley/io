# io
State management for complex forms, that reacts to every change big or small.

```js
const io = new Io({
    form: {
        slug: null,
        title: null,
        services: [],
        metadata: {
            website: null,
            verb: 'Visit Link',
        },
    },

    validation: {
        'slug': 'required|string',
        'title': 'required|string',
        'metadata': 'nullable|object',
        'metadata.verb': 'nullable|string',
        'metadata.website': 'nullable|url',
        'services': 'required|array',
        'services.*.enabled': 'required|boolean',
        'services.*.url': 'required|url',
    }
})

io.on('change', ({ path, value }) => {
    console.log(path, 'changed to', value)
})
```
