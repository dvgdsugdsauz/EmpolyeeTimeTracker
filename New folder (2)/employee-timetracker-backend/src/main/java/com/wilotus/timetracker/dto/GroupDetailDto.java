package com.wilotus.timetracker.dto;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class GroupDetailDto {
    private Long id;
    private String name;
    private List<SubGroupDetail> subGroups = new ArrayList<>();
    private List<MemberInfo> directMembers = new ArrayList<>();

    @Data
    public static class SubGroupDetail {
        private Long id;
        private String name;
        private List<MemberInfo> members = new ArrayList<>();
    }

    @Data
    public static class MemberInfo {
        private String id;
        private String name;
        private String designation;
        private String avatar;
    }
}
