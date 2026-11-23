import { CakeSlice, Cupcake, Donut, Cookie } from "./cake-icons";

const CAKE_ITEMS = [CakeSlice, Cupcake, Donut, Cookie, Cupcake, CakeSlice, Donut, Cookie];

export const CakeScene = () => (
  <>
    {CAKE_ITEMS.map((Item, i) => (
      <i
        key={i}
        style={{
          left: `${(i * 37 + 8) % 86}%`,
          animationDelay: `${-i * 2.1}s`,
          animationDuration: `${15 + (i % 4) * 3}s`,
        }}
      >
        <Item />
      </i>
    ))}
  </>
);
