
import "./style.css";

function component() {
  const element = document.createElement('div');
  const btn = document.createElement('button');

  element.innerHTML = ['Hello', 'webpack'].join(' ');
  element.classList.add('hello');

  btn.innerHTML = 'Click me and check the console!';
  btn.onclick = function printMe() {
    console.log('I get called with local!')
  };

  element.appendChild(btn);
  return element;
}
document.body.appendChild(component());