# ZJAX

ZJAX is a lightweight yet powerful JavaScript library (4.6K gzipped) that brings modern SPA-like interactivity to your web pages with minimal effort. By simply adding intuitive "z-tag" attributes like `z-swap` and `z-action` to your HTML elements, ZJAX lets you dynamically update parts of a web page or bind client-side JavaScript actions directly to the DOM — all without writing verbose JavaScript code.

Inspired by HTMX, Hotwire, and Unpoly and compatible with *any* SSR backend like Rails, Laravel, Django, Astro – or even Wordpress, ZJAX seamlessly integrates into your workflow. 

## Why not just use HTMX or Hotwire?

HTMX and friends broke new ground implementing the idea of ***declarative AJAX*** to be *sprinkled into* the DOM as an alternative to *replacing* the DOM with a heavyweight SPA solution like React or Svelte. ZJAX implements the same functionality but with a simpler syntax and support for client-side Javascript support without reaching for Alpine or Stimulus.

## Getting started

Just include the ZJAX CDN link in your document head.

```html
<head>
  <script src="https://unpkg.com/zjax"></script>
  ...
</head>
```

You can now use ZJAX attributes anywhere in your project.



# `z-swap`

The main workhorse of ZJAX is the `z-swap` attribute which can be added to any HTML tag to specify the elements we want to swap.

*You can try this right now with a plain HTML file.*

**index.html**

```html
<html>
  <head>
    <script src="https://unpkg.com/zjax"></script>
  </head>
  
  <body>
    <h1>This is ZJAX</h1>
    <a href="https://httpbin.org/html" z-swap="p">Fetch Moby Dick</a>
    <p>This will be replaced by ZJAX.</p>    
  </body>
</html>
```

Adding the `z-swap` attribute hijacks this link so that its default behavior is replaced with an AJAX request. The specified `p` is then plucked from response HTML and replaces our local `p` tag *without* affecting any other parts of the page. 

In this example, we specified only the element to be swapped and other specifiers are inferred from context. By default, for an `a` tag, `z-swap` will listen for a `click` event as its trigger, the HTTP method will be `GET`, and the endpoint URL is inferred from `href` value. But these can also be defined explicitly. For the example above, this is the same:
```html
<a href="" z-swap="@click GET https://httpbin.org/html p">
```

We've omitted the `href` value for brevity and because it will be ignored anyway since the explicitly specified endpoint URL takes precedence.

### The wildcard `*` element

If a `*` is used by itself as the response swap element specifier, ZJAX will use entire response. This is most useful when the response is known to be a partial containing only the element or elements needed for the swap. 

For completeness, `*` can also be used for the target element specifier although it probably isn't all that useful since this effectively just replaces the body element contents.

Note that response-types and swap-types can not be combined with `*` since this is somewhat nonsensical. So something like `*|inner` will throw an error.

> ## Format of `z-swap` value
>
>  `z-swap="[@trigger>] [HTTP-method] [endpoint] [swap-elements]"`
>
> All specifiers are optional as long as they can be inferred from context. Each specifier is separated by a space. The order shown above is the recommended convention for readability. Remember that the Trigger must always be prefixed with "@" and that a valid endpoint must always start with "http://", "https://", "/", "./", or can it can be a single dot, ".".

---

### Specifying the Trigger

Try prepending `@mouseover` to the `z-swap` value.

```html
<a href="https://httpbin.org/html" z-swap="@mouseover p">
  Fetch Moby Dick
</a>
```

Any standard DOM event as well as some special ones added by ZJAX and any custom events you have defined globally can be specified prefixed with an @-sign like `@submit`, `@blur`, `@input`, `@dblclick`, `@my-custom-event`, etc.

Note that `@submit` can be used only on a `form` element.

##### The special `@load` trigger

This event will fire when the element is loaded into the DOM. This works for initial page load as well as when elements are loaded into the DOM via a z-swap. Note that under the hood, the actual event listener is coverted to `zjax:load` so as not to conflict with the DOM's standard `load` event. 

>  **Heads up!** Be careful not to create an infinite loop by swapping an element which has a `@load` trigger into itself.

##### The special `@action` trigger

When using a `z-swap` in conjunction with a `z-action` on the same element, the trigger can be set to `@action` which will be triggered when the `z-action` function returns any "truthy" value. This works for both asynchronous and synchronous functions.

### Specifying the Endpoint

The example above infers the endpoint from the `a`-tag's `href` value. But for a `button`, there is no `href` attribute – so you'll want to specify that too as part of the `z-swap` value.

```html
<button z-swap="@mouseover https://httpbin.org/html p">
  Fetch Moby Dick
</button>
```

The endpoint specifier can be any valid URL including local absolute or relative paths as long as it starts with "http://" or "https://", or starts with "/", or "./", or is a single dot ".". Note that the endpoint *must* start with one those options or it will not be recognized as a endpoint.

### Specifying the HTTP-Method

The example above will use the GET method which is the default when using `z-swap` on any element except `form` (then the default is POST). The HTTP methods GET, POST, PUT, PATCH, or DELETE are supported.

```html
<button z-swap="DELETE /books/123 #book-form">
  Click me
</a>
```

Notice that in the example above, we didn't specify the trigger event because the default `click` works great for our button in this case. Here, the HTTP method and a local URL are specified along with the element to be swapped.

### Specifying the SWAP-Element

The swap element is specified with CSS selector syntax like `p`, `#cart`, or `nav > a`. If only one element is specified, it will be used to identify both the response element and the target element to be replaced. Specifying multiple elements to swap at once as well as specifying separate response and target element selectors are also supported. The default swap-type used to replace the entire element can also be changed.

### Swapping Multiple Elements

We aren't limited to swapping just one element. Multiple elements can be swapped at the same time separated by commas. 

```html
<button z-swap="/books/123 #book-form, #cart">
  Click me
</a>
```

In the example above, both the `#book-form` and `#cart-total` elements will be swapped out and replaced with matching elements found in the response. 

### Swapping response->target elements

Sometimes the selector for the target element isn't the same as the response that you want to swap in. Use the `->` operator to specify the response and target elements separately.

```html
<button z-swap="/books/123 #book-form, #updated-cart->#cart">
  Click me
</a>
```

Use a `*` character to specify the entire page content.

```html
<button z-swap="/books/123 *->#book-detail">
  Click me
</a>
```

In the above example, presumably the `/books/123` route returns a partial containing only the elements we need.

### Specifying the Swap-Type

The default swap-type is `outer` which replaces the element in its entirety. Alternatively, you may want to replace only the inner content of the element, or maybe insert the response element *after* the target. The swap-type can be appended to the target element using the pipe `|` character. Note that the swap-type only affects the target element.

```html
<button z-swap="/books/123 #cart-total|after">
  Click me
</a>
```

Swap types available include:

`outer` - Morph the entire element (default)  
`inner` - Morph only inner content  
`before` - Insert before this element  
`prepend` - Insert before all other inner content  
`after` - Insert after this element  
`append` - Insert after all other inner content  
`delete` - Ignore returned value and delete this element  
`none` - Do nothing (typically used with dynamic values)  

### Specifying the Response-Type

The default response-type is `outer` which means that the element found in the response will be used in its entirety. To use only the content found *within* the response element, you can specify the `inner` response type like this:

```html
<button z-swap="/books/123 #books-table|inner->#books-rows|inner">
  Click me
</a>
```

In this example, only the inner contents of the response element will be used to replace only the inner contents of the target element.

Response-Types available include:

`outer` - Use the entire response element (default)  
`inner` - Use only inner content  of the response element

  

# `z-action` 

The `z-action` attribute is used to bind a Javascript method to an element's event listener with syntax similar to `z-swap`. So use `z-swap` to interact with a remote server and use `z-action` to handle client-side only Javascript actions where no round trip to the server is needed (like closing a modal window).

In this example, a `dblclick` event listener is added to the event which will call the `doSomething()` action. 

```html
<div z-action="@dblclick doSomething">
  Do it now!
</div> 
```

In order for this action to work, we need to define it somewhere in our project as ZJAX Action like this:

```html
<script>
  zjax.actions({
    doSomething() {
      alert("I did something!");
    }
  })
</script>
```

### Defining Actions

To register actions, call `zjax.actions([namespace ,]<actions-object>)` with one or two arguments. Use a single argument to pass an object containing only action functions as its direct properties like this:

```js
zjax.actions({
  openModal() {
    ...
  },
  closeModal() {
    ...
  },
  async handleFileUploadDrop() {
    ...
  }
})
```

### Registering Actions with a namespace

Actions can also be registered in their own namespace by providing a string as the first argument like this:
```js
zjax.actions('products', {
  addToCart() {
    ...
  },
  removeFromCart() {
    ...
  }
})
```

For this example, the `z-action` would be used like this:

```html
<button z-action="products.addToCart">
  Add To Cart
</button>
```

Note that since `zjax` is a globally available object, the `zjax.actions()` function may be called as many times as you like from anywhere in your application. This makes it possible to organize your code any way you like, for example you may want to create an `actions/` directory with separate namespaced files for `products.js`, `account.js`, and so on.

### How Actions work

Naturally, an Action function may contain any valid Javascript. Vanilla JS is very powerful these days allowing for full access to DOM manipulation without the need for any JQuery-like library. But ZJAX gives us a couple of handy tools anyway just to make life a bit easier.

### Adding event listeners with `z-action`

Manually adding event listeners from a JS script somewhere else in your project can be tedious and difficult to manage. Event listeners will also need to be removed at some point or they can start stacking up and eventually cause memory leak issues. 

Instead, we can use a `z-action` tag to not only set up the listener and associate it with a function, but also to remove it automatically when the element is removed from the DOM.

> ### *Heads up!*
>
> Watch out for this quirk of HTTP. When a `<script>` tag is added to the DOM for example by a `z-action`, it will be *ignored* by the browser. This means that you can't declare ZJAX Actions within a partial for example. Of course you can use `z-action` attributes in your partials and these will be parsed just fine. But the actual `zjax.action()` function used to *define* the action cannot be called within a `<script>` tag contained in a swap response.

#### The `$` Action Helper object

Action functions receive a `$` argument.

```js
doSomething($) {
  ... // Now can you acccess the $ object
}
```

This object is called the Action Helper and it provides a few handy properties and methods. 

- `$(<selector>)` is a shortcut for `document.querySelector(<selector>)`.
- `$()` returns the element which triggered this action when no selector is provided.
- `$.event` returns the `event` object which triggered this action.


### Applying inline functions directly to `z-action`

For very short snippets of functionality like toggling a class when a button is clicked, ZJAX supports defining the function directly as the ZJAX value like this:

```html
<button z-action="$('#menu').classList.add('open')">
  Open menu
</button>
```

In this example, the default trigger "click" works fine for our needs. Explicit triggers may also be declared as usual.

```html
<button z-action="@mouseover $('#menu').classList.add('open')">
  Open menu
</button>
```

ZJAX is smart enough to recognize when the value looks like an action name and try to find that method in registered actions. If the value doesn't look like an action name – or even if it does but no such action has been registered with `zjax.actions()`, then the value will be treated as a custom inline function.

### Using a ZJAX Action as a `z-swap` trigger

Sometimes it makes sense to trigger a `z-swap` action only once a `z-action` has completed successfully. For example, a `z-action` could be used to await confirmation before executing a dangerous action.

ZJAX makes this very simple. 

1. Specify `@action` as the Trigger event for this `z-swap`.
2. Return `true` from the ZJAX Action function to trigger the `z-swap`.

Note that this works for synchronous and asynchronous functions alike.

```html
<button 
   z-swap="@action DELETE /books/{id}"
   z-action="return confirm("Are you sure?")"
>
  Delete
</button>
```

Notice in the above example that the inline action function returns the boolean value of the confirm function – but you could also return any truthy or un-truthy value either from an inline action or a named action registered on the global zjax object.

