import { QBody, R, mcq, nat } from "./helpers";

export const CALC: QBody[] = [
  nat("limits", 1, R`Evaluate $\lim_{x\to0}\frac{\sin 3x}{x}$.`, 3, 0.01, R`$\frac{\sin3x}{x} = 3\cdot\frac{\sin 3x}{3x} \to 3$.`),
  mcq("limits", 1, R`The function $f(x)=|x|$ at $x=0$ is`, ["Continuous and differentiable", "Continuous but not differentiable", "Differentiable but not continuous", "Neither continuous nor differentiable"], 1,
    "Left and right derivatives are −1 and +1, so no derivative; but the function is continuous."),
  nat("maxmin", 1, R`Find the local minimum value of $f(x) = x^3 - 3x + 2$.`, 0, 0.01,
    R`$f'(x)=3x^2-3=0 \Rightarrow x=\pm1$. $f''(1)=6>0$ so a local min at $x=1$, $f(1)=1-3+2=0$.`),
  nat("taylor", 1, R`Using the second-order Taylor polynomial of $e^x$ about 0, approximate $e^{0.1}$ (3 decimals).`, 1.105, 0.0005,
    R`$1 + 0.1 + 0.1^2/2 = 1.105$.`),
  nat("opt1", 1, "A rectangle has perimeter 20. What is the maximum possible area?", 25, 0.01,
    R`Sides $x$ and $10-x$: area $x(10-x)$ is maximal at $x=5$, giving 25 (a square).`),
  nat("limits", 2, R`Evaluate $\lim_{x\to0}\frac{e^x - 1 - x}{x^2}$.`, 0.5, 0.01,
    R`Using $e^x = 1 + x + \frac{x^2}{2} + \dots$, the numerator is $\frac{x^2}{2} + O(x^3)$, so the limit is $\frac12$.`),
  nat("maxmin", 2, R`For $x>0$, find the maximum value of $f(x) = x^2e^{-x}$ (3 decimals).`, 0.541, 0.005,
    R`$f'(x) = e^{-x}(2x - x^2) = 0 \Rightarrow x = 2$. $f(2) = 4e^{-2} \approx 0.541$.`),
];
