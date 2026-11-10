// The cross at the top right of a dialog. The dialog box itself must be position: relative (see .m-x in site.css).
// inline: sits in a header row (flex, centred) instead of floating in the corner, so it lines up with the buttons beside it.
export default function ModalClose({ onClick, inline = false }: { onClick: () => void; inline?: boolean }) {
  return <button type="button" className={`m-x${inline ? " inline" : ""}`} onClick={onClick} aria-label="Close" title="Close (Esc)">×</button>;
}
