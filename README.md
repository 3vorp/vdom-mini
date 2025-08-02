<div align="center">
  <h1>vDOM Mini</h1>
  <a href="https://www.npmjs.com/package/vdom-mini" target="_blank">
    <img
      alt="npm"
      src="https://img.shields.io/npm/v/vdom-mini?color=cb0000&logo=npm&style=flat-square"
    >
  </a>
  <a href="https://github.com/3vorp/vdom-mini">
    <img
      alt="GitHub file size in bytes"
      src="https://img.shields.io/github/size/3vorp/vdom-mini/index.js?color=43A047&label=Script%20size&logoColor=green&style=flat-square"
    >
  </a>
  <a href="https://github.com/3vorp/vdom-mini/blob/main/CHANGELOG.md">
    <img
      alt="Changelog"
      src="https://img.shields.io/badge/Changelog-Read_Here-blue?style=flat-square"
    >
  </a>
  <br>
  <i>Like an iPad Mini, but instead of a tablet, it's a 250-line virtual DOM implementation from scratch.</i>
</div>

## Setup

You can import the script using any CDN of your choice:

```html
<script src="https://cdn.jsdelivr.net/npm/vdom-mini@latest"></script>
```

From there, you need to declare an empty element to mount your virtual DOM to. This element will be preserved and only the children inside will be modified.

```html
<div id="app"></div>
```

Now you can reference this element when creating a new Virtual DOM instance:

```js
const app = new VirtualDOM({
  el: "#app",
  view(h) {
    return h("h1", null, "Hello from the virtual DOM!");
  },
});
// mount the app to the selector specified in the options object
// you can also provide a different selector as the first parameter
app.mount();
```

## Templates

Templates are written using a React-like createElement function (called `h` for brevity), and exported using the `view()` function. This is the only required option in the VirtualDOM constructor.

```js
const app = new VirtualDOM({
  view(h) {
    // only the first argument is required
    // children can be any combination of strings and other function calls
    return h("div", { class: "container" }, [
      h("h1", { id: "title" }, "This is a title"),
      h("p", null, "This is text"),
    ]);
  },
});
// the function argument takes priority if both are specified
app.mount("#app");
```

## State

You can add state to your app using the `state()` method, which will be run before the DOM is initialized. The first parameter will be a reactivity factory function, which by convention will be referred to as `$`.

```js
new VirtualDOM({
  state($) {
    const title = $("This is a title");
    return { title };
  },
  // all data returned from state is available here using this
  view(h) {
    // data is retrieved using the value getter on each returned reactive object
    return h("h1", null, this.title.value);
  },
});
```

Derived state is returned from the same state hook, along with any functions:

```js
new VirtualDOM({
  state($) {
    const title = $("This is a title");
    // functions inside the reactivity factory function are interpreted as derived state
    const screamingTitle = $(() => title.value.toUpperCase());
    // functions are declared as normal
    function updateTitle() {
      title.value = "Another title";
    }
    // everything is returned at the end
    return { title, screamingTitle, updateTitle };
  },
  // now, all state, derived values, and functions can be accessed through this
  view(h) {
    return h("div", { class: "container" }, [
      h("h1", null, this.screamingTitle.value),
      // event listeners are cased as myevent -> onMyevent
      h(
        "button",
        {
          onClick: () => this.updateTitle(),
        },
        "Click to update title",
      ),
      this.title.value === "This is a title" &&
        h(
          "p",
          null,
          "Conditionally render children using the && operator",
        ),
    ]);
  },
});
```

Effects are stored in a `watch` object.

```js
new VirtualDOM({
  state($) {
    const title = $("my value");
    return { title };
  },
  watch: {
    title(newValue) {
      // shows "Title was changed to another value!" on button click
      alert(`Title was changed to ${newValue}!`);
    },
  },
  view(h) {
    return h("div", { class: "container" }, [
      h("h1", null, this.title.value),
      h("button",
        {
          onClick: () => {
            this.title.value = "another value"
          }
        }
      );
    ]);
  },
});
```

A more Vue.js-like option-based API is available as well:

```js
new VirtualDOM({
  data() {
    return {
      title: "my value",
    };
  },
  methods: {
    updateTitle() {
      // you still have to use .value for getters/setters
      this.title.value = "another title";
    },
  },
  computed: {
    screamingTitle() {
      return this.title.value.toUpperCase();
    },
  },
  view(h) {
    // all state is still available in this
    return h("h1", null, this.screamingTitle.value);
  },
});
```

## Lifecycle Hooks

Lifecycle hooks are available using a similar convention to Vue.js's lifecycle hooks:

```js
new VirtualDOM({
  created() {
    // this runs when state is initialized
    // only state is available here
  },
  mounted() {
    // this runs when the DOM has been mounted to the selector
    // DOM methods like querySelector and getElementById are also available here
  },
  updated() {
    // this runs after the DOM has been updated
    // so DOM methods will point to the latest version
  },
});
```

## Reactivity Implementation

Reactivity is implemented using ES5 getters and setters. When a value is set, it emits an internal signal that rerenders the result of the view function to the actual DOM, and calls any associated watchers once the DOM has been diffed against the previous view function result and reconcilliated with the actual DOM.

The `$` function has two different operations depending on the type of the object passed as the parameter. If the parameter is a regular value, the function returns a reactive object with both a getter and setter for `value`. However, if the parameter itself is a function, the function returns a getter-only object that calls the parameter when accessed. Since the function is polymorphic and therefore the only necessary import to declare all state variables, it's passed in the `state` function call directly to save on code.

```js
// simplified state object representation
({
  _emit() {},
  _value: val,
  get value() {
    return this._value;
  },
  set value(nv) {
    this._value = nv;
    // this will be described more later
    this._emit();
  },
});
// simplified derived object representation
({
  _fn: val,
  get value() {
    // ensure latest version is always received
    return this._fn();
  },
});
```

## Virtual DOM Node Implementation

The `h` function is simply syntactic sugar to easily build a tree of virtual DOM nodes—you can return a series of plain objects in the view function as well for the same behavior if you really wanted to.

```js
h("h1", { class: "heading" }, "This is some text");
// returns
({
  tag: "h1",
  props: { class: "heading" },
  children: ["This is some text"],
});
```

Note how `children` must be an array in the raw object, where in the function non-array children are automatically converted.

## Combining VNodes and Reactivity

The `VirtualDOM` class combines these two different functions (`$` and `h`) into one unified interface. The `state` function (or equivalent data objects) handle reactivity and the `view` function handles DOM nodes, with the class itself serving as the bridge handling reconcilliating, diffing, and dispatching the correct signals at the correct time.

The fundamental link between these two worlds comes through the `_emit` function in a state object. This mysterious value is set when the `state` function gets called, with each state value having its emit function set to rerender the DOM when called.

```js
// state is stored as a field on the VirtualDOM instance called $data
this.$data[k]._emit = () => {
  // use cached result from the previous render to diff the changes
  const prevNodes = this._vNodeCache;
  // save new result to the now-outdated vnode cache for the next render
  this._vNodeCache = this.$view(createElement);
  // diff the outdated and rerendered nodes and apply changes to the actual DOM
  rerender(this.$el, prevNodes, this._vNodeCache);
  // handle watchers and lifecycle hooks
  this.onUpdate();
  this.$watchers[k](this.$data);
};
```

Now that setting a value rerenders the DOM and applies only the necessary changes, this is effectively the bare bones of the entire virtual DOM done. There isn't an extensive component system like other frameworks, but for adding simple reactivity to a project in a declarative way, this project is a fairly reasonable option.
