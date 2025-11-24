import Flag from "react-world-flags";

const CountryFlag = ({
  isoCode,
  className,
}: {
  isoCode: string;
  className?: string | undefined;
}) => {
  const classes = className ? className : "w-full h-48 object-cover";

  return <Flag code={isoCode} className={classes} alt={`Flag of ${isoCode}`} />;
};

export default CountryFlag;
