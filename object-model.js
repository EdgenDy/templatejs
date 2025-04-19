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


function initializeImpl() {
  const elements = document.querySelectorAll("[js\\:object-model]");
  
  for (const element of elements)
    initializeObjectModelDOM(element);
}

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

  initializeContentBindings(element, objectModel);
  initializeEventBindings(element, objectModel);
  initializeReferenceBindings(element, objectModel);

  element.removeAttribute("js:object-model");
}

function initializeContentBindings(dom, objectModel) {
  const elements = dom.querySelectorAll("[js\\:content]");
  for (const element of elements)
    bindContent(element, objectModel);
}

function initializeEventBindings(dom, objectModel) {
  const clickElements = dom.querySelectorAll("[js\\:on-click]");
  for (const element of clickElements)
    bindEvent(element, "click", objectModel);
}

function initializeReferenceBindings(dom, objectModel) {
  const refElements = dom.querySelectorAll("[js\\:ref]");

  for (const element of refElements)
    referenceElement(element, objectModel);
}

function bindContent(element, objectModel) {
  const name = element.getAttribute("js:content");
  const properties = objectModel[name].properties;

  element.removeAttribute("js:content");
  
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

function referenceElement(element, objectModel) {
  const refName = element.getAttribute("js:ref");
  const valueObj = objectModel[refName];

  element.removeAttribute("js:ref");

  if (!valueObj)
    return;

  valueObj.value = element;
}

function notifyBindedElements(valueObject, newValue) {
  const properties = valueObject.properties;
  const attributes = valueObject.attributes;

  for (const propName in properties) {
    const bindings = properties[propName];
    for (const element of bindings)
      element[propName] = newValue;
  }

  for (const propName in attributes) {
    const bindings = attributes[propName];
    for (const element of bindings)
      element[propName] = newValue;
  }
}

component.initialize();