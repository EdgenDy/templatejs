function initialize() {
  const domContentLoadedHandler = () => {
    initializeImpl();
    document.removeEventListener("DOMContentLoaded", domContentLoadedHandler);
  };

  document.addEventListener("DOMContentLoaded", domContentLoadedHandler);
}

const isArray = Array.isArray;

const objectModelMap = {};
const objectModelDOMInstanceMap = {};

function createModel(name, object) {
  if (typeof object != "object")
    return false;
  
  const objectModelTemplate = objectModelMap[name];
  if (isArray(objectModelTemplate)) {
    const objectModelInstances = objectModelTemplate;
    for (const element of objectModelInstances)
      initializeObjectModelDOM(element);
  }

  objectModelMap[name] = object;

  return true;
}

function getInstanceById(id) {
  const objectModelInstance = objectModelDOMInstanceMap[id];
  if (!objectModelInstance)
    return null;

  return objectModelInstance[objectModelInstanceProxyObjectSymbol];
}

function instantiateObjectModel(objectModel) {
  const result = Object.create(null);
  const proxy = new Proxy(result, objectModelInstanceProxy);

  for (const propName in objectModel) {
    const initValue = objectModel[propName];
    
    if (typeof initValue == "function") {
      result[propName] = { value: initValue.bind(proxy) };
      continue;
    }

    result[propName] = { 
      value: initValue, 
      properties: Object.create(null), 
      attributes: Object.create(null) 
    };
  }

  result[objectModelInstanceProxyObjectSymbol] = proxy;
  
  return result;
}

const objectModelInstanceProxyObjectSymbol = Symbol("object-model-instance-proxy-object");
const objectModelInstanceProxy = {
  set(target, name, value) {
    const valueObject = target[name];
    if (!valueObject)
      return true;

    notifyBindedElements(valueObject, value);
    valueObject.value = value;

    return true;
  },

  get(target, name) {
    const valueObj = target[name];
    if (valueObj)
      return valueObj.value;

    return undefined;
  }
};

const component = new (function Component() {
  this.initialize = initialize;
  this.createModel = createModel;
  this.getInstanceById = getInstanceById;
});

const queryObjectModel = "[js\\:object-model]";
const queryRouter = "[js\\:router]";
const queryLink = "[js\\:link]";
const eventClick = "click";

function initializeImpl() {
  const elements = document.querySelectorAll(queryObjectModel);
  const routers = document.querySelectorAll(queryRouter);
  const routerLink = document.querySelectorAll(queryLink);

  for (const element of elements)
    initializeObjectModelDOM(element);

  for (const element of routers)
    initializeRouterBindings(element);

  for (const element of routerLink)
    initializeRouterLinks(element);
}

const attrObjectModel = "js:object-model";

function initializeObjectModelDOM(element) {
  const objectModelName = element.getAttribute("js:object-model");
  const objectModelTemplate = objectModelMap[objectModelName];
  const objectModelID = element.id;

  if (!objectModelTemplate) {
    objectModelMap[objectModelName] = [element];
    return;
  }

  if (Array.isArray(objectModelTemplate)) {
    objectModelTemplate.push(element);
    return;
  }

  const objectModel = instantiateObjectModel(objectModelTemplate);
  if (objectModelID)
    objectModelDOMInstanceMap[objectModelID] = objectModel;

  initializeSwitchCaseBindings(element, objectModel);
  initializeContentBindings(element, objectModel);
  initializeEventBindings(element, objectModel);
  initializeReferenceBindings(element, objectModel);

  element.removeAttribute("js:object-model");
}

const querySwitch = "[js\\:switch]";
const attrSwitch = "js:switch";

function initializeSwitchCaseBindings(dom, objectModel) {
  const elements = dom.querySelectorAll(querySwitch);
  
  if (dom.hasAttribute(attrSwitch))
    bindElementCase(dom, objectModel);

  for (const element of elements)
    bindElementCase(element, objectModel);
}

const routerBindings = [];
const queryPath = "[js\\:path]";
const attrRouter = "js:rounter";
const attrPath = "js:path";
const attrHidden = "hidden";

function initializeRouterBindings(dom) {
  const pathName = window.location.pathname;
  const currentPath = dom.getAttribute(attrRouter);
  const pathElements = dom.querySelectorAll(queryPath);
  dom.removeAttribute(attrRouter);

  for (const element of pathElements) {
    const pathValue = element.getAttribute(attrPath);
    element.removeAttribute(attrHidden);
    element.removeAttribute(attrPath);

    const anchor = createAnchorNode(`path: ${pathValue}`);
    element.before(anchor);

    if (currentPath != pathValue)
      element.remove();

    routerBindings.push({ element, pathValue, anchor });
  }
}

window.addEventListener("popstate", (event) => {
  console.log(event);
  notifyLinks();
});

const attrLink = "js:link";

function initializeRouterLinks(element) {
  const pathname = element.pathname;
  const title = element.getAttribute(attrLink);

  element.addEventListener(eventClick, linkHandler(pathname, title));
}

function linkHandler(pathname, title) {
  return function(event) {
    event.preventDefault();
    history.pushState({pathname}, title, pathname);
    notifyLinks();
  }
}

function notifyLinks() {
  const pathname = location.pathname;
  for (const link of routerBindings)
    if (link.pathValue == pathname)
      link.anchor.after(link.element);
    else
      link.element.remove();
}

const queryContent = "[js\\:content]";
function initializeContentBindings(dom, objectModel) {
  const elements = dom.querySelectorAll(queryContent);
  for (const element of elements)
    bindContent(element, objectModel);
}

const queryOnClick = "[js\\:on-click]";
function initializeEventBindings(dom, objectModel) {
  const clickElements = dom.querySelectorAll(queryOnClick);
  for (const element of clickElements)
    bindEvent(element, eventClick, objectModel);
}

const queryRef = "[js\\:ref]";
function initializeReferenceBindings(dom, objectModel) {
  const refElements = dom.querySelectorAll(queryRef);

  for (const element of refElements)
    referenceElement(element, objectModel);
}

const attrContent = "js:content";

function bindContent(element, objectModel) {
  const name = element.getAttribute(attrContent);
  const properties = objectModel[name].properties;
  const value = objectModel[name].value;

  if (value)
    element.textContent = value;

  element.removeAttribute(attrContent);
  
  if (!properties.textContent) {
    properties.textContent = [element];
    return;
  }

  properties.textContent.push(element);
}

function bindEvent(element, eventName, objectModel) {
  const name = element.getAttribute(`js:on-${eventName}`);
  const valueObj = objectModel[name];

  element.removeAttribute(`js:on-${eventName}`);

  if(!valueObj)
    return;

  element.addEventListener(eventName, valueObj.value);
}

function createAnchorNode(name) {
  return document.createComment(`case: ${name}`);
}

const queryCase = "[js\\:case]";
const attrCase = "js:case";

function bindElementCase(element, objectModel) {
  const caseElements = element.querySelectorAll(queryCase);
  const propName = element.getAttribute(attrSwitch);
  
  element.removeAttribute(attrSwitch);

  const valueObj = objectModel[propName];
  if (!valueObj)
    return;

  const initValue = valueObj.value;
  const cases = valueObj.cases = [];
  
  for (const element of caseElements) { 
    const caseValue = element.getAttribute(attrCase);
    const anchor = createAnchorNode(caseValue);

    element.removeAttribute(attrCase);
    element.before(anchor);

    if (initValue != caseValue)
      element.remove();

    element.removeAttribute(attrHidden);
    cases.push({ element, caseValue, anchor });
  }
}

const attrRef = "js:ref";
function referenceElement(element, objectModel) {
  const refName = element.getAttribute(attrRef);
  const valueObj = objectModel[refName];

  element.removeAttribute(attrRef);

  if (!valueObj)
    return;

  valueObj.value = element;
}

function notifyBindedElements(valueObject, newValue) {
  const properties = valueObject.properties;
  const attributes = valueObject.attributes;
  const cases = valueObject.cases;

  if (properties)
    for (const propName in properties) {
      const bindings = properties[propName];
      for (const element of bindings)
        element[propName] = newValue;
    }

  if (attributes)
    for (const propName in attributes) {
      const bindings = attributes[propName];
      for (const element of bindings)
        element[propName] = newValue;
    }

  if (cases)
    for (const caseEntry of cases) {
      if (caseEntry.caseValue == newValue)
        caseEntry.anchor.after(caseEntry.element);
      else
        caseEntry.element.remove();
    }
}

component.initialize();