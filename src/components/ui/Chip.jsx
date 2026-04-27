export default function Chip({ children, color, onClick, className = '' }) {
  const style = color
    ? { borderColor: `${color}66`, background: `${color}1a`, color: color }
    : undefined
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      onClick={onClick}
      className={`chip ${onClick ? 'cursor-pointer hover:brightness-125' : ''} ${className}`}
      style={style}
    >
      {children}
    </Tag>
  )
}
