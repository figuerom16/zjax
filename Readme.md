# ZJAX

ZJAX is a tiny Javascript library (2Kb gzipped) that makes it possible to add modern SPA-like interactivity to a website by sprinkling "z-tag" attributes onto plain HTML elements. Using attributes such as `z-swap` or `z-action` gives your HTML tags superpowers including the ability to swap out *parts of* a web page or attach client-side Javascript actions to DOM elements.

Use ZJAX with Rails, Laravel, Django, Astro, or any other SSR backend you like. It is heavily inspired by HTMX and Unpoly with some powerful new concepts.

## Getting started

Link ZJAX from a CDN:

```html
<script src="https://unpkg.com/zjax"></script>
```

##### Now use z-tags anywhere

Z-tags aren't really tags – they're attributes that can be added to tags. But z-tags rolls off the tongue so much nicer than "z-attributes" – so, z-tags it is.



# `z-swap`

The main workhorse of ZJAX is the `z-swap` attribute which can be added to any HTML tag to specify the elements we want to swap.

You can try this right now. Create two routes using your favorite SSR framework, or even just as plain HTML using a local web server (like the Live Server extension for VS Code).

**index.html**

```html
<html>
  <head>
		<script src="./src/zjax.js"></script>  
  </head>
  
  <body>
    <h1>This is ZJAX</h1>
    <section id="swapme">
      <h3>What can ZJAX do for HTML?</h3>
      <a href="/other.html" z-swap="#swapme">Click me</a>
    </section>
  </body>
</html>
```



**other.html**

```html
<html>
  <body>
    <h1 id="header">ZJAX gives HTML superpowers!</h1>
  </body>
</html>
```



By adding the `z-swap` tag, this link will be hijacked by ZJAX, replacing it's default behavior with an AJAX request which makes a GET request to npmjs.com. It then appends the `h1` element found in the response to the `#viewer` element in our local DOM without affecting any other parts of the page. 

In this example, we provided only the element to be swapped without specifying the endpoint URL, the HTTP method, or the trigger event type. So these are inferred. By default, for an `a`-tag, `z-swap` uses the GET method and the endpoint inferred from `href` and will listen for the `click` event as its trigger.

> ## Format of `z-swap` value
>
>  `z-swap="[@Event-Type>] [HTTP-Method] [Endpoint] Swap-Elements"`
>
> The Event-Type, HTTP-Method, and Endpoint are all optional but must be specified in the order shown if present. Each specifier is separated by a space. Swap-Elements are required and must always be specified as the last (or only) value.

---

##### Specifying the Event-Type

Try prepending `@mouseover` to the `z-swap` value.

```html
<a href="https://npmjs.com" z-swap="@mouseover main">
  Click me
</a>
```

Any standard DOM event as well as some special ones added by ZJAX and even custom events (more on this later) can be specified with an @-sign like `@submit`, `@blur`, `@input`, `@dblclick`, etc.

##### Specifying the Endpoint

The example above infers the endpoint from the `a`-tag's `href` value. But for a `button` tag, there's no `href` attribute – so we can specify that too as part of the `z-swap` value.

```html
<button z-swap="@mouseover https://npmjs.com main">
  Click me
</a>
```

The Endpoint can be any valid URL including local absolute or relative paths.

##### Specifying the HTTP-Method

The example above defaults to using a GET method which is the default when using `z-swap` on any element except `form` (then the default is POST). The HTTP methods GET, POST, PUT, PATCH, or DELETE can be prepended to the specified URL.

```html
<button z-swap="DELETE /books/123 #book-form">
  Click me
</a>
```

Notice that in the example above, we didn't specify the trigger event because the default `click` is just what we wanted anyway. Here, the HTTP method and a local URL in this case are specified along with the element to be swapped. 

##### Swapping multiple elements

We aren't limited to swapping just one element. Multiple elements can be swapped at the same time separated by commas. 

```html
<button z-swap="/books/123 #book-form, #cart-total">
  Click me
</a>
```

In the example above, both the `#book-form` and `#cart-total` elements will be swapped for the elements found in the response. 

##### Swapping source->target elements

Sometimes the target element isn't the same as the source. Use the `->` to specify a source element from the response that should be used to replace the target element in the current DOM.

```html
<button z-swap="/books/123 #book-form, #updated-cart->#cart-total">
  Click me
</a>
```

Use a `*` character to specify the entire page content.

```html
<button z-swap="/books/123 *->#book-detail">
  Click me
</a>
```

In the above example, perhaps the `/books/123` route returns a partial

##### Specifying the swap type

The default swap type is to replace the element in its entirety. Alternatively, you may want to replace only the inner content of the element, or maybe insert the new element *after* the existing one. The swap type can be appended to any target element using the pipe `|` character.

```html
<button z-swap="/books/123 #cart-total|after">
  Click me
</a>
```

Swap type available include:

`outer` - Morph the entire element (default)
`inner` - Morph only inner content
`before` - Insert before this element
`prepend` - Insert before all other inner content
`after` - Insert after this element
`append` - Insert after all other inner content
`delete` - Ignore returned value and delete this element
`none` - Do nothing (typically used with dynamic values)