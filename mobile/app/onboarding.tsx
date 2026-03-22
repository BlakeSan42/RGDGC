import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingPage {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  description: string;
}

const PAGES: OnboardingPage[] = [
  {
    icon: "disc",
    iconColor: colors.secondary,
    title: "Score Your Rounds",
    subtitle: "Track every throw",
    description:
      "Keep score hole-by-hole with our intuitive scorecard. View your round history, track stats, and watch your game improve over time.",
  },
  {
    icon: "trophy",
    iconColor: colors.accent.gold,
    title: "Join Leagues",
    subtitle: "Compete and climb",
    description:
      "Sign up for Dubs and Sunday Singles leagues. Earn season points, check live standings, and compete for prizes with your club.",
  },
  {
    icon: "qr-code",
    iconColor: colors.accent.blue,
    title: "Track Your Discs",
    subtitle: "Never lose a disc again",
    description:
      "Register your discs with unique QR codes. When someone finds your disc, they can instantly contact you to return it.",
  },
  {
    icon: "paw",
    iconColor: colors.accent.purple,
    title: "Meet Clawd",
    subtitle: "Your AI assistant",
    description:
      "Ask Clawd anything about disc golf. Get course tips, check league standings, look up PDGA rules, and more — right from the chat tab.",
  },
];

function PageContent({
  page,
  index,
  scrollX,
}: {
  page: OnboardingPage;
  index: number;
  scrollX: Animated.Value;
}) {
  const inputRange = [
    (index - 1) * SCREEN_WIDTH,
    index * SCREEN_WIDTH,
    (index + 1) * SCREEN_WIDTH,
  ];

  const iconScale = scrollX.interpolate({
    inputRange,
    outputRange: [0.6, 1, 0.6],
    extrapolate: "clamp",
  });

  const iconOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.3, 1, 0.3],
    extrapolate: "clamp",
  });

  const textTranslateY = scrollX.interpolate({
    inputRange,
    outputRange: [30, 0, 30],
    extrapolate: "clamp",
  });

  const textOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.page}>
      <View style={styles.pageTop}>
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [{ scale: iconScale }],
              opacity: iconOpacity,
            },
          ]}
        >
          <View
            style={[
              styles.iconBackground,
              { backgroundColor: page.iconColor + "15" },
            ]}
          >
            <Ionicons name={page.icon} size={80} color={page.iconColor} />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.textContent,
            {
              transform: [{ translateY: textTranslateY }],
              opacity: textOpacity,
            },
          ]}
        >
          <Text style={styles.pageTitle}>{page.title}</Text>
          <Text style={styles.pageSubtitle}>{page.subtitle}</Text>
          <Text style={styles.pageDescription}>{page.description}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentPage, setCurrentPage] = useState(0);

  const isLastPage = currentPage === PAGES.length - 1;

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: true }
  );

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setCurrentPage(page);
    },
    []
  );

  const handleSkip = useCallback(() => {
    router.replace("/(auth)/welcome");
  }, [router]);

  const handleGetStarted = useCallback(() => {
    router.replace("/(auth)/welcome");
  }, [router]);

  const handleNext = useCallback(() => {
    if (isLastPage) {
      handleGetStarted();
    } else {
      scrollViewRef.current?.scrollTo({
        x: (currentPage + 1) * SCREEN_WIDTH,
        animated: true,
      });
    }
  }, [currentPage, isLastPage, handleGetStarted]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip button */}
      <View style={styles.skipContainer}>
        {!isLastPage ? (
          <Pressable onPress={handleSkip} hitSlop={12} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      {/* Pages */}
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {PAGES.map((page, index) => (
          <PageContent
            key={index}
            page={page}
            index={index}
            scrollX={scrollX}
          />
        ))}
      </Animated.ScrollView>

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        {/* Dot indicators */}
        <View style={styles.dotsContainer}>
          {PAGES.map((_, index) => {
            const inputRange = [
              (index - 1) * SCREEN_WIDTH,
              index * SCREEN_WIDTH,
              (index + 1) * SCREEN_WIDTH,
            ];

            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: "clamp",
            });

            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: "clamp",
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Action button */}
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
        >
          <Text style={styles.actionButtonText}>
            {isLastPage ? "Get Started" : "Next"}
          </Text>
          {!isLastPage && (
            <Ionicons
              name="arrow-forward"
              size={20}
              color={colors.text.inverse}
              style={{ marginLeft: spacing.xs }}
            />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  skipContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    height: 44,
  },
  skipButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  skipText: {
    fontSize: fontSize.base,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  pageTop: {
    alignItems: "center",
    width: "100%",
  },
  iconContainer: {
    marginBottom: spacing.xl,
  },
  iconBackground: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  textContent: {
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },
  pageTitle: {
    fontSize: fontSize["4xl"],
    fontWeight: "800",
    color: colors.primary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  pageDescription: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 320,
  },
  bottomControls: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: "center",
    gap: spacing.lg,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actionButton: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 52,
  },
  actionButtonPressed: {
    opacity: 0.9,
  },
  actionButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.inverse,
  },
});
