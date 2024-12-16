

---

## ** OLD PLANNING FOLLOWS **

---



## `z-swap`

Use `z-swap` to hijack responses from regular links and form submissions, then swap only the specified elements rather than the entire page. Can be used with any HTML element with default method and event listener and inferred endpoint, or with the addition of a `z-<method>` attribute to specify the HTTP method and target URL. 

When using `z-swap` with an `a` tag, the HTTP method will default to GET, the event listener will default to `click`, and the target URL will be inferred from the `href`. Similarly, when using `z-swap` with a `form` tag, the event listener is `submit`, and HTTP method and target URL are inferred from the `method` and `action` attributes. To submit a form using non-default http methods, events listeners, or target URLs, see `z-<method>` below.

At its simplest, `z-swap` can be used with no value and will swap the `body` element by default.

**Default `body` swap:** 

```html
<a href="/books/123" z-swap>More info</a>
```



one or more CSS selectors are specified to morph only the matching returned element(s) into the DOM. 

**Single Selector:** 

```html
<a href="/books/123" z-swap="#book-detail">More info</a>
```

Multiple elements can be separated by commas. 

**Multiple Selectors:** 

```html
<a href="/books/123" z-swap="#cart, #cart-items-count">
  More info
</a>
```

If multiple elements match a selector, they will be swapped in order with leftover items removed or additional items appended. Parent elements' `class` attribute is initially retained, then swapped later in order to trigger CSS transitions (unless Idiomorph handles that for us).

To specify a source element other than the target, use `source->target` syntax.

**Source -> Target:**

```html
<a href="/books/123" z-swap="cart, #the-book->#book-detail">
  More info
</a>
```

When the route supplied by either the `href` or `action` attibute is not a 200 status response, the target value is replaced with `body` so that the appropriate error page can be shown.

When a target element is not present in the source or returned document, a JS warning is thrown to alert the developer.

#### Specifying the swap type

By default, the swap type is `outer` meaning that the entire element is merged with the new element using idiomorph to morph the element rather than replacing the DOM element. This means that only changed content is actually updated in the DOM, thereby retaining things like client-side state, scroll-position, and so on. 

**Available swap types are:**
`outer` - Morph the entire element (default)
`inner` - Morph only inner content
`before` - Insert before this element
`prepend` - Insert before all other inner content
`after` - Insert after this element
`append` - Insert after all other inner content
`delete` - Ignore returned value and delete this element
`none` - Do nothing (typically used with dynamic values)

To specify a swap type, use a pipe character to append it to the target element. Note that this can be used with or without a specificied source element.

**Swap Type**

```html
<a href="/books/123" z-swap="#more-info->#book-detail|append">
	More info
</a>
```

## `z-event` and `z-<event>`

Use `z-event` to specify an event listener for an element like `z-event="mouseover"` or a custom event listener such as `z-event="upload-completed"`. When used along with `z-swap`, the target URL will be inferred (or defaults to self) and only the default event listener will be overridden.

In addition to the event listener, a target url and/or HTTP method separated with a space can also be supplied.

**Specified Target URL**

```html
<button z-event="click->/books/123" z-swap="#book-detail">
  More info
</button>
```

**Specified Target URL w/HTTP Method**

```html
<button z-event="click->DELETE /books/123" z-swap="#book-detail|delete">
  Delete this book
</button>
```

Notice that the swap type has been set to delete so that in the above example, the deleted book would be removed from the DOM.

Multiple events->targets can be specified and separated by commas.

**Multiple Comma-Separated Events**

```html
<button 
  z-event="click->DELETE /books/123, mouseover->GET /books/placeholder" 
  z-swap="#book-detail|delete">
  Delete this book
</button>
```

Notice that the swap type has been set to delete so that in the above example, the deleted book 

In rare cases, it may be useful to specify only the event type and HTTP method. The target URL will be inferred.

**Specified Event and Method Only**

```html
<button z-event="click->PUT" z-swap="#book-detail">
  More info
</button>
```

**Shorter Syntax For Standard Events**



# NOTES

I think I should start a new doc because I realize now that `z-swap` should really be merged into `z-event`. The thinking is that you may want to do different things on the same element. For mouseover do one thing, for click do something else, for double-click do another thing. 

So let's do something like this:



```html
<a z-event="@mouseover GET /books #book-detail|append">
```

Here's how the syntax parsing works:

First, strip any spaces around commas so that the string of swap elements is collapsed before the next step.

Next, split the string on `||` characters for multiple events. That allows syntax like this:

```html
<a z-event="
	@click GET /books/123 #book-detail || 
  @mouseover GET /books/123/preview #book-preview
  "
>
	Click me or hover me
</a>
```

Loop through `||` split array, then split first item on spaces into another array.

First item if present starts with `@`? that's our event type, otherwise default to submit for form tags or click for everything else.

Next item is one of GET, POST, PUT, PATCH, or DELETE? That's our HTTP method, otherwise default to GET or POST.

LAST item is swap elements

If an item remains, that's the URL.

---

Wait maybe a better idea...

Collapse space-adjacent-commas, then for each item in `||`-split array, split on spaces.

Work backwards:

The last item in the array *must be* swap elements, even if just `body` or for the whole page. Swap elements are not optional.

---

**This is getting complicated.**

---

How about we make the easy things easy and the hard things possible.

So...

`z-event="@upload-complete POST /books #book-detail|append"`

or... how about if we only support standard clicks and require a controller for anything fancy?

so...

`z-click="POST /books #book-detail|append"`

---

Here's a thought... HTMX doesn't support multiple stuff like this at all. So let's assume most `z-<event>` tags are going to be used on links and forms. For the rare case where it isn't, we can define a `z-endpoint`.

Wait... what's actually the problem here? I think it's only that you can't have an endpoint with no target elements OR a elements with no endpoint – because then when there's only one argument, we won't know whether it's an endpoint or swap elements.

Simple solution:

swap elements are NOT optional. If you want to swap the entire page, use `*`. Or you could just specify `body` to swap the whole body. 

So then all of these will be predictably parseable:

`z-click="#book-detail|append"`

`z-click="POST /books #book-detail|append"`

`z-event="@click POST /books #book-detail|append"`

and as an added bonus, we can use `z-swap` as a generic for the default event only on forms or links where an action or -- actually no. Then we're back to the question of how to set a form's http method to "patch". So let's just use `z-click` and `z-submit` *instead of* href and action.

---

The alternative is to go back to drop-dead simple: `z-swap`. Works great when an `action` or `href` is present. If there isn't one, then you need to add a `z-action` to specify the URL and optionally the method. 

---

I actually think maybe `z-swap` makes things more complex. If we ditch the idea of using the href and action from forms, things get a lot simpler. 

`<form id="book-form" z-submit="POST /books #book-form">`

or...

`<form id="book-form" z-submit="/books">` // default swap this id

---

### Time to radically simplify...

First of all, no big long strings with tricky to remember syntax. 

Second, any element you want to swap needs an `id` attribute. This is the ideal way to identify unique elements in the DOM.

Make the easy things *really* easy FIRST.

So... simplest case is a link to add something to cart and update one or more elements by id.

`<a href="/add-to-cart/4" z-swap="#cart, #cart-items-count">`

That's incredibly powerful with nothing to learn really.

Same thing with forms:
`<form action="/add-to-cart/4" z-swap="#cart, #cart-items-count">`

If you need to specify a method, use a `z-method` or if in a form and using GET or POST, just use a regular HTML method. This is much easier to remember than a bespoke mini-language passed in as a string like "@click DELETE /some/path #foo->#bar" or whatever. 

The catch is that this works only for elements which have a single listener for a single route. Now here's the escape hatch:

`<a href="/books" z-controller="books_link">`

This assumes that somewhere, you've added a handler to the global `zen` object maybe something like this:

```js
zen.controllers({
  books_link(z) {
    // Here the z (zen) object contains our element
    // and functions which allow us to "manually"
    // fire off ajax requests and the like. Of course,
    // We also have full access to DOM manipulation here.
  }
})
```

So that's all down the road but shouldn't be too hard to implement -- and this will be the escape hatch.

---

But what about useful stuff like `z-load` and `z-intersect` ?

I'm waffling on `z-swap` as I've implement it because it feels really limited to links and forms. What about things like lazy loading images or form rows?

What if a table has database results that are a fairly long query and I want to load the rest of the page first before firing off that request?

`<table z-load="/books/table-rows *|append">Loading...</table>`

---

WHOA! Here's an idea...

```js
zen.events([
  'upload-complete', 
  'new-chat-arrived'
])
```

By allowing you to add new events, zen can scan the markup for these custom listeners `z-upload-complete`, `z-new-chat-arrived`.

Oh wow -- so then we don't really need controllers. Instead we can register `actions` which can return true/false and can then be used as a fake ternary.

```js
zen.actions({
  show_dialog($) {
    $('#dialog').classList.add('open')
    return true
  }
})
```

So the idea is that we forget about `z-swap` and instead always use `z-<event>` which can even be a custom event as long is it was registered.

The value of for example `z-click` can reference a "zen action" (javascript) or "zen swap" (ajax). It can even do both and make the swap dependent on the outcome of the action like this:

```html
<a href="/books/123" 
   z-method="patch" 
   z-click="custom_confirmation ? #book-detail"
>
  Save
</a>
```



# OKAY I THINK I GOT IT (ZJAX!)

I definitely want the simplicity of `z-swap` when used with an `href` or `action` tag.

The `z-swap` should only specify the source->target elements and swap method - nothing more.

The default is the whole `body` if not specified or inferred

The assumption is that (like HTMX), you'll only have one set of swap parameters per element. In HTMX, you can define your target URL, your trigger, and so on. You can't have different DOM swaps for different triggers. So let's design the API for that 90% use case.

For elements without an `href` or an `action`, we can provide the target URL to a `z-<event>` .

So instead of...
`<a href="/books/123" z-swap="#book-detail">Info</a>`

We could do...

`<button z-click="/books/123" z-swap="#book-detail">Info</button>`

But what if we want the a tag to also react on rollover?

Hmmm... maybe just add a `z-mouseover` with no args?

`<a href="/books/123" z-mouseover z-swap="#book-detail">Info</a>`

Actually, that works.

And if I wanted mouseover to trigger a JS action... Hmmm... maybe it does still make sense to allow passing a JS method name to a `z-<event>` handler. Yeah I think that's pretty doable and easy to understand.

Just use something like `z-mouseover` and give it a value that is either a URL or a `zen.<method>`. To use both, just use a `&&` to connect them so that the swap only happens if zen action returns true.

### Okay let's wrap up:

`z-swap` is often all you need. The URL and method can usually be inferred from `href` or `action`. For a form, the default method of `post` can be overridden with a `z-method`. 

To specify a different target URL, assign it to a `z-<event>` like `z-click` which now I think SHOULD include the URL – because most of the time, setting a `z-click` or whatever on a button for example, will need a URL. So why not assume that `z-swap` is used when both the URL and trigger can be inferred -- more thinking needed here...

### Hopefully the last iteration on this...

If we're commited to the idea of only one swap action per element (and unlimited actions per element), then why not just use `z-swap` for everything like this:

```html
<a href="/books/123" z-swap="#book-detail"
```

...and to specify a different trigger:

```html
<button z-swap="@mouseover GET /books/123 #book-detail">
  info
</button>
```

That's actually pretty tidy. The trick is to always require the swap elements argument – even if just `*` or `body`. Oh... this is also a backtrack on requiring IDs for swaps. Let's instead require that your selector matches only one element on the page. That could be `scrollable-area` for example (custom HTML element that only appears one time).

I think this is good because it's usually edge case. It also reads very English-like: "at mouseover, get /books/123 #book-detail" – it's very clear exactly what that does. But more often, the action and the endpoint will be inferred.

### What about swap options?

How about things down the road like debouncing or animation?

~~`z-swap-opts="debounce(100), animate(fade)"`~~

...or maybe these should just be separate. Yes, I think that if the only JS related stuff is in `z-action`, then basically all other z-tags can be assumed to be swap options like `z-confirm`, `z-debounce` -- actually debounce could maybe be part of the trigger syntax like `@input:debounce(100)`.

```html
<input 
   z-swap="@input:debounce(100) POST /books closest.fieldset"
/>
```

```html
<a
   z-swap=":confirm('Are you sure?') DELETE /books/123 form"
/>
```



Oh man this is sick. And the same syntax above could be used for `z-action` like this:

`z-action="@keydown(esc) books.close_window"`

### Okay so what are the z-tags now?

`z-swap`
Swaps specified elements. Requires swap elements optionally prepended with a trigger type and/or an endpoint URL (which can be optionally prepended with a method).

`z-action`
Requires a javascript action which has been registered on the `zjax` object and optionally a trigger type.

`z-active`
Applied to any link with an href to add an `.active` class to that element when the URL starts with the `href` value of this element (default) or the URL value specified. Can also be applied to a parent element (like a `nav`) to affect all child links.

##### Later...

`z-modal`, `z-drawer` - Opens specified URL and source elements in a modal or drawer. Optionally prepended with a trigger type.



