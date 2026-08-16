import { ThanksScreen } from "@/features/store/thanks-screen";

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  return <ThanksScreen reference={ref ?? ""} />;
}
